// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

const { ccclass, property } = cc._decorator;
import Board from "../model/Board";
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

@ccclass
export default class BoardView extends cc.Component {

    private static WHITE_SPRITE_FRAME: cc.SpriteFrame | null = null;

    @property(cc.Integer)
    cellSize: number = 50;

    @property(cc.Integer)
    padding: number = 1;

    @property(cc.SpriteAtlas)
    tileAtlas: cc.SpriteAtlas | null = null;

    private tileSpriteFrames: Map<TileColor, cc.SpriteFrame> = new Map();
    private _onTileClick: TileClickHandler | null = null;

    setOnTileClick(handler: TileClickHandler | null): void {
        this._onTileClick = handler;
    }

    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        BoardView.createWhiteSpriteFrame();
        this.loadTileSpriteFrames();
    }

    start() {

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
                this.tileSpriteFrames.set(color as TileColor, spriteFrame);
                loadedCount++;
            } else {
                cc.warn(`[BoardView] ✗ Sprite frame ${spriteName} not found for color ${color}`);
            }
        }

        if (loadedCount < Object.keys(TILE_SPRITE_MAP).length) {
            cc.warn(`[BoardView] Loaded only ${loadedCount}/${Object.keys(TILE_SPRITE_MAP).length} tile sprites`);
        } else {
            // cc.log(`[BoardView] ✓ Successfully loaded all ${loadedCount} tile sprites`);
        }
    }

    render(board: Board) {
        cc.log('[BoardView] render', board.toString());

        // Очищаем предыдущие тайлы
        this.clearTiles();

        // Размеры доски
        const width = board.width;
        const height = board.height;

        // Создаём узел для каждой ячейки
        for (let col = 0; col < width; col++) {
            for (let row = 0; row < height; row++) {
                const tile = board.getTile(col, row);
                if (!tile) {
                    cc.warn(`[BoardView] The tile was not found in the position (${col}, ${row})`);
                    continue;
                }

                const tileNode = this.createTileNode(col, row, tile, width, height);
                this.node.addChild(tileNode);
            }
        }

        cc.log(`[BoardView] ${width * height} tiles have been drawn`);
    }

    // update (dt) {}

    private static createWhiteSpriteFrame(): void {

        if (!BoardView.WHITE_SPRITE_FRAME) {
            // Простой белый спрайт через canvas (если в атласе нет кадра)
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
                cc.log('[BoardView] Created white sprite');

                BoardView.WHITE_SPRITE_FRAME = spriteFrame;
            } else {
                cc.error("[BoardView] Couldn't create canvas context");
            }
        }
    }

    private clearTiles(): void {
        this.node.removeAllChildren();
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

        // Создание узла
        const tileNode = new cc.Node(`Tile_${col}_${row}`);

        if (!(tile instanceof NormalTile)) {
            cc.warn('[BoardView] Not supported tile type ');
            return tileNode;
        }

        const color: TileColor = (tile as NormalTile).color;

        const sprite = tileNode.addComponent(cc.Sprite);

        // Пытаемся взять кадр из атласа для этого цвета
        let spriteFrame: cc.SpriteFrame | null = this.tileSpriteFrames.get(color) || null;
        if (spriteFrame) {
            sprite.spriteFrame = spriteFrame;
            tileNode.color = cc.Color.WHITE;
        } else {
            // Запасной вариант: белый квадрат + цвет узла
            if (BoardView.WHITE_SPRITE_FRAME) {
                spriteFrame = BoardView.WHITE_SPRITE_FRAME;
                sprite.spriteFrame = spriteFrame;
                tileNode.color = this.tileColorToCCColor(color);
            } else {
                cc.error(`[BoardView] createTileNode (${col}, ${row}): no sprite frame available for ${color}`);
            }
        }

        // Размер ячейки в UI
        tileNode.setContentSize(this.cellSize, this.cellSize);

        // Вписываем спрайт в ячейку, сохраняя пропорции
        if (spriteFrame) {
            const rect = spriteFrame.getRect();
            const originalWidth = rect.width;
            const originalHeight = rect.height;

            const scaleX = this.cellSize / originalWidth;
            const scaleY = this.cellSize / originalHeight;

            const scale = Math.min(scaleX, scaleY);

            tileNode.setScale(scale, scale);
        }

        // Расчет позиции
        const x = (col - width / 2 + 0.5) * (this.cellSize + this.padding);
        const y = (row - height / 2 + 0.5) * (this.cellSize + this.padding);

        tileNode.setPosition(x, y);

        this.bindTileTouch(tileNode, col, row);

        return tileNode;

    }

    private bindTileTouch(tileNode: cc.Node, col: number, row: number): void {
        tileNode.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
            event.stopPropagation();
            if (this._onTileClick) {
                this._onTileClick(col, row);
            }
        });
    }
}
