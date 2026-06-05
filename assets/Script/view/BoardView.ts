// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

const { ccclass, property } = cc._decorator;
import Board from "../model/Board";
import { BoardCell } from "../model/Board";
import NormalTile from "../model/NormalTile";
import { TileColor } from "../model/TileColor";
import Tile from "../model/Tile";
import GameConfig from "../GameConfig";
import AnimateEffects, { BombTileAnimEntry } from "./AnimateEffects";

// Маппинг цветов тайлов на имена спрайтов в атласе
const TILE_SPRITE_MAP: Record<TileColor, string> = {
    [TileColor.RED]: 'block_red',
    [TileColor.GREEN]: 'block_green',
    [TileColor.BLUE]: 'block_blue',
    [TileColor.YELLOW]: 'block_yellow',
    [TileColor.PURPURE]: 'block_purpure'
};

export type TileClickHandler = (col: number, row: number) => void;
export type TileTeleportHandler = (fromCol: number, fromRow: number, toCol: number, toRow: number) => void;
type BlastCompleteHandler = (score: number) => void;

interface TileNodeMeta {
    col: number;
    row: number;
    baseScale: number;
}

@ccclass
export default class BoardView extends cc.Component {

    private static WHITE_SPRITE_FRAME: cc.SpriteFrame | null = null;

    @property({ type: cc.Node, tooltip: 'Узел фона с рамкой (по умолчанию дочерний bg)' })
    frameNode: cc.Node | null = null;

    @property({ tooltip: 'Отступ сетки от краёв bg, чтобы была видна рамка' })
    frameInset: number = 35;

    @property({ tooltip: 'Горизонтальный зазор между ячейками (px)' })
    tileGapX: number = 0;

    @property({ tooltip: 'Вертикальный зазор между ячейками (px): отрицательное => шапки тайлов наезжают друг на друга' })
    tileGapY: number = -10;

    @property(cc.SpriteAtlas)
    tileAtlas: cc.SpriteAtlas | null = null;

    @property({ tooltip: 'Длительность исчезновения группы (сек)' })
    blastDuration: number = 0.18;

    @property({ tooltip: 'Длительность взрыва бомбы (сек)' })
    bombBlastDuration: number = 0.62;

    @property({ tooltip: 'Длительность ударной волны бомбы (сек)' })
    bombShockwaveDuration: number = 0.9;

    @property({ tooltip: 'Длительность падения тайлов (сек)' })
    fallDuration: number = 0.22;

    @property({ tooltip: 'Длительность прилёта новых тайлов (сек)' })
    refillDuration: number = 0.28;

    private _cellSize: number = 50; // Размер тайла (px), рассчитывается в applyGridLayout() с учётом размера frameNode и GameConfig ROWS/COLS
    private _stepX: number = 50; // Шаг позиции тайлов по X (px), с учётом tileGapX
    private _stepY: number = 40; // Шаг позиции тайлов по Y (px), с учётом tileGapY

    private _tileSpriteFrames: Map<TileColor, cc.SpriteFrame> = new Map();
    private _tileNodes: Map<string, cc.Node> = new Map();
    private _tilesLayer: cc.Node | null = null;
    private _onTileClick: TileClickHandler | null = null;
    private _onTileTeleport: TileTeleportHandler | null = null;
    private _isTeleportMode: boolean = false;
    private _isAnimating: boolean = false;
    private _board: Board | null = null;
    private _dragSourceMeta: TileNodeMeta | null = null;
    private _dragSourceNode: cc.Node | null = null;
    private _dragGhostNode: cc.Node | null = null;

    get isAnimating(): boolean {
        return this._isAnimating;
    }

    setOnTileClick(handler: TileClickHandler | null): void {
        this._onTileClick = handler;
    }

    setTeleportMode(enabled: boolean, handler: TileTeleportHandler | null): void {
        this._isTeleportMode = enabled;
        this._onTileTeleport = handler;
        if (!enabled) {
            this.cancelTeleportDrag();
        }
    }

    onLoad() {
        if (!this.frameNode) {
            this.frameNode = this.node.getChildByName('bg') ?? this.node;
        }

        BoardView.createWhiteSpriteFrame();
        this.loadTileSpriteFrames();
        this._tilesLayer = this.node.getChildByName('tilesLayer');
        if (!this._tilesLayer) {
            cc.error('[BoardView] Под boardNode добавьте пустой дочерний узел `tilesLayer` (тайлы создаются только в нём).');
        }
    }

    onEnable(): void {
        cc.view.setResizeCallback(this.onViewResize);
    }

    onDisable(): void {
        cc.view.setResizeCallback(() => {});
        this.unschedule(this.refreshGridLayout);
    }

    private onViewResize = (): void => {
        this.scheduleOnce(this.refreshGridLayout, 0);
    };

    private loadTileSpriteFrames(): void {
        if (!this.tileAtlas) {
            cc.error('[BoardView] Tile atlas not assigned');
            return;
        }

        let loadedCount = 0;
        for (const [color, spriteName] of Object.entries(TILE_SPRITE_MAP)) {
            const spriteFrame = this.tileAtlas.getSpriteFrame(spriteName);

            if (spriteFrame) {
                this._tileSpriteFrames.set(color as TileColor, spriteFrame);
                loadedCount++;
            } else {
                cc.warn(`[BoardView] ✗ Sprite frame ${spriteName} not found for color ${color}`);
            }
        }

        if (loadedCount < Object.keys(TILE_SPRITE_MAP).length) {
            cc.warn(`[BoardView] Loaded only ${loadedCount}/${Object.keys(TILE_SPRITE_MAP).length} tile sprites`);
        }
    }

    render(board: Board): void {
        if (!this._tilesLayer) {
            return;
        }
        this._board = board;
        this.applyGridLayout(board.colCount, board.rowCount);
        this.clearTiles();

        const width = board.colCount;
        const height = board.rowCount;

        for (let col = 0; col < width; col++) {
            for (let row = 0; row < height; row++) {
                const tile = board.getTile(col, row);
                if (!tile) {
                    cc.warn(`[BoardView] The tile was not found in the position (${col}, ${row})`);
                    continue;
                }

                const tileNode = this.createTileNode(col, row, tile, width, height);
                this.getTilesRoot().addChild(tileNode);
                this.registerTileNode(tileNode, col, row);
            }
        }
    }

    playBlast(board: Board, group: BoardCell[], onComplete: BlastCompleteHandler | null): void {
        if (!Board.isBlastableGroup(group)) {
            return;
        }

        this.playRemoveCells(board, group, (cells) => board.blast(cells), onComplete);
    }

    /** Взрыв бомбы: ударная волна + разлёт тайлов от эпицентра. */
    playBombBlast(
        board: Board,
        cells: BoardCell[],
        centerCol: number,
        centerRow: number,
        applyBoard: (cells: BoardCell[]) => number,
        onComplete: BlastCompleteHandler | null
    ): void {
        if (!this._tilesLayer || this._isAnimating || cells.length === 0) {
            return;
        }

        this._isAnimating = true;

        const colCount = board.colCount;
        const rowCount = board.rowCount;
        const removeKeys = new Set(cells.map(cell => BoardView.cellKey(cell.col, cell.row)));
        const centerPos = this.cellToLocalPosition(centerCol, centerRow, colCount, rowCount);
        const cellStep = Math.max(this._stepX, this._stepY);

        const columnSurvivors = this.collectColumnSurvivors(removeKeys);
        const blastEntries: BombTileAnimEntry[] = [];

        cells.forEach((cell) => {
            const node = this._tileNodes.get(BoardView.cellKey(cell.col, cell.row));
            if (!node) {
                return;
            }

            const meta = this.getTileNodeMeta(node);
            const waveDist = Math.max(
                Math.abs(cell.col - centerCol),
                Math.abs(cell.row - centerRow)
            );

            blastEntries.push({
                node,
                waveDelaySec: waveDist * 0.028,
                baseScale: meta?.baseScale ?? node.scale,
            });
        });

        removeKeys.forEach(key => this._tileNodes.delete(key));

        const area = this.getBlastArea(cells, colCount, rowCount);
        if (BoardView.WHITE_SPRITE_FRAME) {
            AnimateEffects.playBombEffect(
                this.getTilesRoot(),
                BoardView.WHITE_SPRITE_FRAME,
                area.center,
                area.halfSize,
                (GameConfig.BOMB_RADIUS + 0.6) * cellStep,
                this.bombShockwaveDuration
            );
        }
        AnimateEffects.shakeNodeX(this.node, 14, 0.06);

        AnimateEffects.explodeNodesFromCenter(
            blastEntries,
            centerPos,
            this.bombBlastDuration,
            cellStep * 1.4,
            () => {
                const score = applyBoard(cells);
                this.animateColumnMoves(board, columnSurvivors, colCount, rowCount, () => {
                    this._isAnimating = false;
                    if (onComplete) {
                        onComplete(score);
                    }
                });
            }
        );
    }

    /** Сжигание произвольного набора клеток (бомба и т.п.). */
    playRemoveCells(
        board: Board,
        cells: BoardCell[],
        applyBoard: (cells: BoardCell[]) => number,
        onComplete: BlastCompleteHandler | null
    ): void {
        if (!this._tilesLayer || this._isAnimating || cells.length === 0) {
            return;
        }

        this._isAnimating = true;

        const colCount = board.colCount;
        const rowCount = board.rowCount;
        const removeKeys = new Set(cells.map(cell => BoardView.cellKey(cell.col, cell.row)));

        const columnSurvivors = this.collectColumnSurvivors(removeKeys);
        const blastNodes = cells
            .map(cell => this._tileNodes.get(BoardView.cellKey(cell.col, cell.row)))
            .filter((node): node is cc.Node => !!node);

        removeKeys.forEach(key => this._tileNodes.delete(key));

        this.animateBlastNodes(blastNodes, () => {
            const score = applyBoard(cells);
            this.animateColumnMoves(board, columnSurvivors, colCount, rowCount, () => {
                this._isAnimating = false;
                if (onComplete) {
                    onComplete(score);
                }
            });
        });
    }

    private collectColumnSurvivors(removeKeys: Set<string>): Map<number, cc.Node[]> {
        const columnSurvivors = new Map<number, cc.Node[]>();

        this._tileNodes.forEach((node, key) => {
            if (removeKeys.has(key)) {
                return;
            }

            const meta = this.getTileNodeMeta(node);
            if (!meta) {
                return;
            }

            if (!columnSurvivors.has(meta.col)) {
                columnSurvivors.set(meta.col, []);
            }
            columnSurvivors.get(meta.col)!.push(node);
        });

        columnSurvivors.forEach(nodes => {
            nodes.sort((a, b) => this.getTileNodeMeta(a)!.row - this.getTileNodeMeta(b)!.row);
        });

        return columnSurvivors;
    }

    /** Возвращает колбэк: вызвать по завершении каждого из total твинов. При total === 0 сразу onComplete. */
    private createTweenCounter(total: number, onComplete: () => void): () => void {
        if (total <= 0) {
            onComplete();
            return () => {};
        }

        let remaining = total;
        return () => {
            remaining--;
            if (remaining === 0) {
                onComplete();
            }
        };
    }

    private getBlastArea(
        cells: BoardCell[],
        colCount: number,
        rowCount: number
    ): { center: cc.Vec2; halfSize: cc.Vec2 } {
        let minCol = cells[0].col;
        let maxCol = cells[0].col;
        let minRow = cells[0].row;
        let maxRow = cells[0].row;

        cells.forEach((cell) => {
            minCol = Math.min(minCol, cell.col);
            maxCol = Math.max(maxCol, cell.col);
            minRow = Math.min(minRow, cell.row);
            maxRow = Math.max(maxRow, cell.row);
        });

        return {
            center: this.cellToLocalPosition(
                (minCol + maxCol) / 2,
                (minRow + maxRow) / 2,
                colCount,
                rowCount
            ),
            halfSize: cc.v2(
                ((maxCol - minCol + 1) * this._stepX) / 2,
                ((maxRow - minRow + 1) * this._stepY) / 2
            ),
        };
    }

    private animateBlastNodes(nodes: cc.Node[], onComplete: () => void): void {
        const onTweenDone = this.createTweenCounter(nodes.length, onComplete);

        nodes.forEach((node, index) => {
            cc.tween(node)
                .delay(index * 0.02)
                .to(this.blastDuration, { scale: 0, opacity: 0 }, { easing: 'backIn' })
                .call(() => {
                    node.destroy();
                    onTweenDone();
                })
                .start();
        });
    }

    /**
     * Считает, сколько твинов движения нужно запустить для всех колонок.
     * 1) Выжившие тайлы: +1, если тайл должен упасть в другой row.
     * 2) Новые тайлы: +1 на каждый создаваемый тайл (для заполнения пустот сверху).
     * Нужен для createTweenCounter, чтобы понять, когда анимация полностью закончена.
     */
    private countColumnMoveTweens(
        columnSurvivors: Map<number, cc.Node[]>,
        width: number,
        height: number
    ): number {
        let count = 0;

        for (let col = 0; col < width; col++) {
            const survivors = columnSurvivors.get(col) || [];

            survivors.forEach((node, index) => {
                const meta = this.getTileNodeMeta(node);
                if (meta && meta.row !== index) {
                    count++;
                }
            });

            count += height - survivors.length;
        }

        return count;
    }

    /**
     * Анимирует пересборку всех колонок после удаления:
     * - выжившие тайлы падают на новые row;
     * - недостающие тайлы создаются сверху и прилетают вниз.
     * По завершении всех твинов вызывается onComplete.
     */
    private animateColumnMoves(
        board: Board,
        columnSurvivors: Map<number, cc.Node[]>,
        width: number,
        height: number,
        onComplete: () => void
    ): void {
        this._tileNodes.clear();

        const tweenCount = this.countColumnMoveTweens(columnSurvivors, width, height);
        const onTweenDone = this.createTweenCounter(tweenCount, onComplete);

        for (let col = 0; col < width; col++) {
            const survivors = columnSurvivors.get(col) || [];

            survivors.forEach((node, index) => {
                const newRow = index;
                const meta = this.getTileNodeMeta(node)!;
                const needsMove = meta.row !== newRow;
                const targetPos = this.cellToLocalPosition(col, newRow, width, height);

                node.name = `Tile_${col}_${newRow}`;
                this.setTileNodeMeta(node, col, newRow, meta.baseScale);
                this.registerTileNode(node, col, newRow);

                if (!needsMove) {
                    return;
                }

                cc.tween(node)
                    .to(this.fallDuration, { x: targetPos.x, y: targetPos.y }, { easing: 'sineOut' })
                    .call(onTweenDone)
                    .start();
            });

            const newTileCount = height - survivors.length;
            for (let row = survivors.length; row < height; row++) {
                const tile = board.getTile(col, row);
                if (!tile) {
                    continue;
                }

                const targetPos = this.cellToLocalPosition(col, row, width, height);
                const spawnRow = row + newTileCount;
                const spawnPos = this.cellToLocalPosition(col, spawnRow, width, height);

                const tileNode = this.createTileNode(col, row, tile, width, height);
                tileNode.setPosition(spawnPos);
                tileNode.opacity = 255;
                this.getTilesRoot().addChild(tileNode);
                this.registerTileNode(tileNode, col, row);

                cc.tween(tileNode)
                    .to(this.refillDuration, { x: targetPos.x, y: targetPos.y }, { easing: 'backOut' })
                    .call(onTweenDone)
                    .start();
            }
        }
    }

    private static createWhiteSpriteFrame(): void {
        if (!BoardView.WHITE_SPRITE_FRAME) {
            const spriteFrame = new cc.SpriteFrame();
            const texture = new cc.Texture2D();
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, 64, 64);
                texture.initWithElement(canvas);
                spriteFrame.setTexture(texture);
                BoardView.WHITE_SPRITE_FRAME = spriteFrame;
            } else {
                cc.error("[BoardView] Couldn't create canvas context");
            }
        }
    }

    private clearTiles(): void {
        this._tileNodes.clear();
        this._tilesLayer?.removeAllChildren();
    }

    private getTilesRoot(): cc.Node {
        return this._tilesLayer!;
    }

    /** Пересчёт сетки после resize / смены ориентации (без пересоздания тайлов). */
    private refreshGridLayout(): void {
        if (!this._board || !this._tilesLayer || this._isAnimating || this._tileNodes.size === 0) {
            return;
        }

        const colCount = this._board.colCount;
        const rowCount = this._board.rowCount;
        this.applyGridLayout(colCount, rowCount);
        this.relayoutTileNodes(colCount, rowCount);
    }

    /** Подгоняет размер клетки под frameNode и GameConfig ROWS/COLS. */
    private applyGridLayout(colCount: number, rowCount: number): void {
        if (!this.frameNode) {
            return;
        }

        const boardSize = this.node.getContentSize();
        this.frameNode.setContentSize(boardSize.width, boardSize.height);

        const frameSize = this.frameNode.getContentSize();
        const inset = Math.max(0, this.frameInset);
        const availW = Math.max(0, frameSize.width - inset * 2);
        const availH = Math.max(0, frameSize.height - inset * 2);

        const cellFromW = colCount > 0
            ? (availW - this.tileGapX * (colCount - 1)) / colCount
            : this._cellSize;
        const cellFromH = rowCount > 0
            ? (availH - this.tileGapY * (rowCount - 1)) / rowCount
            : this._cellSize;

        this._cellSize = Math.max(1, Math.floor(Math.min(cellFromW, cellFromH)));
        this._stepX = this._cellSize + this.tileGapX;
        this._stepY = this._cellSize + this.tileGapY;
    }

    private relayoutTileNodes(colCount: number, rowCount: number): void {
        this._tileNodes.forEach((tileNode) => {
            const meta = this.getTileNodeMeta(tileNode);
            if (!meta) {
                return;
            }
            this.applyTileNodeLayout(tileNode, meta.col, meta.row, colCount, rowCount);
        });
    }

    private applyTileNodeLayout(
        tileNode: cc.Node,
        col: number,
        row: number,
        colCount: number,
        rowCount: number
    ): void {
        tileNode.setContentSize(this._cellSize, this._cellSize);

        const sprite = tileNode.getComponent(cc.Sprite);
        let baseScale = 1;
        if (sprite && sprite.spriteFrame) {
            const rect = sprite.spriteFrame.getRect();
            baseScale = Math.min(this._cellSize / rect.width, this._cellSize / rect.height);
            tileNode.setScale(baseScale, baseScale);
        }

        tileNode.setPosition(this.cellToLocalPosition(col, row, colCount, rowCount));
        this.setTileNodeMeta(tileNode, col, row, baseScale);
    }

    private cellToLocalPosition(col: number, row: number, width: number, height: number): cc.Vec2 {
        const x = (col - width / 2 + 0.5) * this._stepX;
        const y = (row - height / 2 + 0.5) * this._stepY;
        return cc.v2(x, y);
    }

    private registerTileNode(tileNode: cc.Node, col: number, row: number): void {
        this._tileNodes.set(BoardView.cellKey(col, row), tileNode);
    }

    private static cellKey(col: number, row: number): string {
        return `${col},${row}`;
    }

    private setTileNodeMeta(node: cc.Node, col: number, row: number, baseScale: number): void {
        (node as cc.Node & { __tileMeta?: TileNodeMeta }).__tileMeta = { col, row, baseScale };
    }

    private getTileNodeMeta(node: cc.Node): TileNodeMeta | null {
        return (node as cc.Node & { __tileMeta?: TileNodeMeta }).__tileMeta || null;
    }

    private tileColorToCCColor(tileColor: TileColor): cc.Color {
        switch (tileColor) {
            case TileColor.RED: return cc.Color.RED;
            case TileColor.GREEN: return cc.Color.GREEN;
            case TileColor.BLUE: return cc.Color.BLUE;
            case TileColor.YELLOW: return cc.Color.YELLOW;
            case TileColor.PURPURE:
                const color = new cc.Color();
                color.fromHEX("#FF00FF");
                return color;
            default: return cc.Color.WHITE;
        }
    }

    private createTileNode(col: number, row: number, tile: Tile, width: number, height: number): cc.Node {
        const tileNode = new cc.Node(`Tile_${col}_${row}`);

        if (!(tile instanceof NormalTile)) {
            cc.warn('[BoardView] Not supported tile type ');
            return tileNode;
        }

        const color: TileColor = tile.color;
        const sprite = tileNode.addComponent(cc.Sprite);

        let spriteFrame: cc.SpriteFrame | null = this._tileSpriteFrames.get(color) || null;
        if (spriteFrame) {
            sprite.spriteFrame = spriteFrame;
            tileNode.color = cc.Color.WHITE;
        } else if (BoardView.WHITE_SPRITE_FRAME) {
            spriteFrame = BoardView.WHITE_SPRITE_FRAME;
            sprite.spriteFrame = spriteFrame;
            tileNode.color = this.tileColorToCCColor(color);
        } else {
            cc.error(`[BoardView] createTileNode (${col}, ${row}): no sprite frame available for ${color}`);
        }

        this.applyTileNodeLayout(tileNode, col, row, width, height);
        this.bindTileTouch(tileNode);

        return tileNode;
    }

    private bindTileTouch(tileNode: cc.Node): void {
        tileNode.on(cc.Node.EventType.TOUCH_START, (event: cc.Event.EventTouch) => {
            event.stopPropagation();
            if (!this._isTeleportMode || this._isAnimating || !this._onTileTeleport) {
                return;
            }

            const meta = this.getTileNodeMeta(tileNode);
            if (!meta) {
                return;
            }

            this.beginTeleportDrag(tileNode, meta, event);
        });

        tileNode.on(cc.Node.EventType.TOUCH_MOVE, (event: cc.Event.EventTouch) => {
            event.stopPropagation();
            if (!this._isTeleportMode || !this._dragGhostNode) {
                return;
            }

            const local = this.node.convertToNodeSpaceAR(event.getLocation());
            this._dragGhostNode.setPosition(local);
        });

        tileNode.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
            event.stopPropagation();
            if (this._isTeleportMode) {
                this.finishTeleportDrag(event);
                return;
            }

            if (this._isAnimating || !this._onTileClick) {
                return;
            }

            const meta = this.getTileNodeMeta(tileNode);
            if (meta) {
                this._onTileClick(meta.col, meta.row);
            }
        });

        tileNode.on(cc.Node.EventType.TOUCH_CANCEL, (event: cc.Event.EventTouch) => {
            event.stopPropagation();
            if (!this._isTeleportMode) {
                return;
            }
            this.finishTeleportDrag(event);
        });
    }

    private beginTeleportDrag(tileNode: cc.Node, meta: TileNodeMeta, event: cc.Event.EventTouch): void {
        this.cancelTeleportDrag();
        this._dragSourceMeta = { ...meta };
        this._dragSourceNode = tileNode;
        this._dragSourceNode.opacity = 90;

        const tileSprite = tileNode.getComponent(cc.Sprite);
        if (!tileSprite || !tileSprite.spriteFrame) {
            return;
        }

        const ghost = new cc.Node("teleport_drag_ghost");
        const ghostSprite = ghost.addComponent(cc.Sprite);
        ghostSprite.spriteFrame = tileSprite.spriteFrame;
        ghost.setContentSize(tileNode.getContentSize());
        ghost.color = tileNode.color;
        ghost.opacity = 220;
        ghost.scale = tileNode.scale * 1.07;
        ghost.zIndex = 3000;

        const local = this.node.convertToNodeSpaceAR(event.getLocation());
        ghost.setPosition(local);
        this.node.addChild(ghost);
        this._dragGhostNode = ghost;
    }

    private finishTeleportDrag(event: cc.Event.EventTouch): void {
        const source = this._dragSourceMeta;
        if (!source || !this._onTileTeleport) {
            this.cancelTeleportDrag();
            return;
        }

        const target = this.findTileMetaByWorldPoint(event.getLocation());
        if (target && (target.col !== source.col || target.row !== source.row)) {
            this._onTileTeleport(source.col, source.row, target.col, target.row);
        }

        this.cancelTeleportDrag();
    }

    private cancelTeleportDrag(): void {
        if (this._dragSourceNode) {
            this._dragSourceNode.opacity = 255;
        }
        if (this._dragGhostNode) {
            this._dragGhostNode.destroy();
        }
        this._dragSourceNode = null;
        this._dragSourceMeta = null;
        this._dragGhostNode = null;
    }

    private findTileMetaByWorldPoint(worldPoint: cc.Vec2): TileNodeMeta | null {
        let result: TileNodeMeta | null = null;
        this._tileNodes.forEach((tileNode) => {
            if (result || !tileNode.isValid) {
                return;
            }
            const box = tileNode.getBoundingBoxToWorld();
            if (box.contains(worldPoint)) {
                result = this.getTileNodeMeta(tileNode);
            }
        });
        return result;
    }
}
