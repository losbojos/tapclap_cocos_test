// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

const { ccclass, property } = cc._decorator;
import Board from "../model/Board";
import { TileColor } from "../model/TileColor";

@ccclass
export default class BoardView extends cc.Component {

    private static WHITE_SPRITE_FRAME: cc.SpriteFrame | null = null;

    @property(cc.Integer)
    cellSize: number = 50;

    @property(cc.Integer)
    padding: number = 2;


    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        BoardView.createWhiteSpriteFrame();
    }

    start() {

    }

    render(board: Board) {
        cc.log('[BoardView] render', board.toString());

        // Очищаем предыдущие тайлы
        this.clearTiles();

        // Получаем размеры доски
        const width = board.width;
        const height = board.height;

        // Создаём тайлы для каждой ячейки
        for (let col = 0; col < width; col++) {
            for (let row = 0; row < height; row++) {
                const tile = board.getTile(col, row);
                if (!tile) {
                    cc.warn(`[BoardView] Тайл не найден на позиции (${col}, ${row})`);
                    continue;
                }

                const tileNode = this.createTileNode(col, row, tile.color, width, height);
                this.node.addChild(tileNode);
            }
        }

        cc.log(`[BoardView] Отрисовано ${width * height} тайлов`);
    }

    // update (dt) {}

    private static createWhiteSpriteFrame(): void {

        if (!BoardView.WHITE_SPRITE_FRAME) {
            // Создаём простой белый спрайт через canvas
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
                cc.log('[BoardView] Создан белый спрайт');

                BoardView.WHITE_SPRITE_FRAME = spriteFrame;
            } else {
                cc.error('[BoardView] Не удалось создать canvas контекст');
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
            case TileColor.PURPLE_PINK:
                const color = new cc.Color();
                color.fromHEX("#FF00FF");
                return color;
            default: return cc.Color.WHITE;
        }
    }

    private createTileNode(col: number, row: number, color: TileColor, width: number, height: number): cc.Node {
        // Создание узла
        const tileNode = new cc.Node(`Tile_${col}_${row}`);

        // Добавление компонента Sprite
        const sprite = tileNode.addComponent(cc.Sprite);
        if (BoardView.WHITE_SPRITE_FRAME) {
            sprite.spriteFrame = BoardView.WHITE_SPRITE_FRAME;
        }

        // Установка цвета (в Cocos Creator цвет устанавливается на узле)
        tileNode.color = this.tileColorToCCColor(color);

        // Установка размера
        tileNode.setContentSize(this.cellSize, this.cellSize);

        // Расчет позиции (центрирование доски)
        const x = (col - width / 2 + 0.5) * (this.cellSize + this.padding);
        const y = (row - height / 2 + 0.5) * (this.cellSize + this.padding);
        tileNode.setPosition(x, y);

        return tileNode;
    }
}
