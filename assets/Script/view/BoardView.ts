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

// Маппинг цветов тайлов на имена спрайтов в атласе
const TILE_SPRITE_MAP: Record<TileColor, string> = {
    [TileColor.RED]: 'block_red',
    [TileColor.GREEN]: 'block_green',
    [TileColor.BLUE]: 'block_blue',
    [TileColor.YELLOW]: 'block_yellow',
    [TileColor.PURPURE]: 'block_purpure'
};

export type TileClickHandler = (col: number, row: number) => void;
type BlastCompleteHandler = (score: number) => void;

interface TileNodeMeta {
    col: number;
    row: number;
    baseScale: number;
}

@ccclass
export default class BoardView extends cc.Component {

    private static WHITE_SPRITE_FRAME: cc.SpriteFrame | null = null;

    @property(cc.Integer)
    cellSize: number = 50;

    @property(cc.Integer)
    padding: number = 1;

    @property(cc.SpriteAtlas)
    tileAtlas: cc.SpriteAtlas | null = null;

    @property({ tooltip: 'Длительность исчезновения группы (сек)' })
    blastDuration: number = 0.18;

    @property({ tooltip: 'Длительность падения тайлов (сек)' })
    fallDuration: number = 0.22;

    @property({ tooltip: 'Длительность прилёта новых тайлов (сек)' })
    refillDuration: number = 0.28;

    private _tileSpriteFrames: Map<TileColor, cc.SpriteFrame> = new Map();
    private _tileNodes: Map<string, cc.Node> = new Map();
    private _tilesLayer: cc.Node | null = null;
    private _onTileClick: TileClickHandler | null = null;
    private _isAnimating: boolean = false;

    get isAnimating(): boolean {
        return this._isAnimating;
    }

    setOnTileClick(handler: TileClickHandler | null): void {
        this._onTileClick = handler;
    }

    onLoad() {
        BoardView.createWhiteSpriteFrame();
        this.loadTileSpriteFrames();
        this._tilesLayer = this.node.getChildByName('tilesLayer');
        if (!this._tilesLayer) {
            cc.error('[BoardView] Под boardNode добавьте пустой дочерний узел `tilesLayer` (тайлы создаются только в нём).');
        }
    }

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
        if (!this._tilesLayer || this._isAnimating || !Board.isBlastableGroup(group)) {
            return;
        }

        this._isAnimating = true;

        const colCount = board.colCount;
        const rowCount = board.rowCount;
        const removeKeys = new Set(group.map(cell => BoardView.cellKey(cell.col, cell.row)));

        const columnSurvivors = this.collectColumnSurvivors(removeKeys);
        const blastNodes = group
            .map(cell => this._tileNodes.get(BoardView.cellKey(cell.col, cell.row)))
            .filter((node): node is cc.Node => !!node);

        removeKeys.forEach(key => this._tileNodes.delete(key));

        this.animateBlastNodes(blastNodes, () => {
            const score = board.blast(group);
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
     * Падение: выживший сдвигается, если старый row ≠ новый index (после compact).
     * Refill: в столбце height - survivors.length новых (= число сгоревших в этом столбце).
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

    private cellToLocalPosition(col: number, row: number, width: number, height: number): cc.Vec2 {
        const x = (col - width / 2 + 0.5) * (this.cellSize + this.padding);
        const y = (row - height / 2 + 0.5) * (this.cellSize + this.padding);
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

        tileNode.setContentSize(this.cellSize, this.cellSize);

        let baseScale = 1;
        if (spriteFrame) {
            const rect = spriteFrame.getRect();
            const scale = Math.min(this.cellSize / rect.width, this.cellSize / rect.height);
            baseScale = scale;
            tileNode.setScale(scale, scale);
        }

        tileNode.setPosition(this.cellToLocalPosition(col, row, width, height));
        this.setTileNodeMeta(tileNode, col, row, baseScale);
        this.bindTileTouch(tileNode);

        return tileNode;
    }

    private bindTileTouch(tileNode: cc.Node): void {
        tileNode.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
            event.stopPropagation();
            if (this._isAnimating || !this._onTileClick) {
                return;
            }

            const meta = this.getTileNodeMeta(tileNode);
            if (meta) {
                this._onTileClick(meta.col, meta.row);
            }
        });
    }
}
