import { TileColor } from "./TileColor";
import Tile from "./Tile";
import { TileType } from "./TileType";

export default class NormalTile extends Tile {
    private _color: TileColor;
 
    constructor(color: TileColor) {
        super(TileType.NORMAL);
        this._color = color;
    }

    get color(): TileColor {
        return this._color;
    }

    isEqual(other: Tile): boolean {
        return other instanceof NormalTile && super.isEqual(other) && this._color === other.color;
    }

    toString(): string {
        return `[NormalTileData color=${this._color}]`;
    }
}