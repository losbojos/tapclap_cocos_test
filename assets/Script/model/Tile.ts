import { TileColor } from "./TileColor";

export default class Tile {
    private _color: TileColor;
 
    constructor(color: TileColor) {
        this._color = color;
    }

    get color(): TileColor {
        return this._color;
    }    

    toString(): string {
        return `[Tile color=${this._color}]`;
    }
}