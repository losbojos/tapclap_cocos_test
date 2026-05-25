import { TileType } from "./TileType";

export default class Tile {
    private _type: TileType;
 
    constructor(type: TileType) {
        this._type = type;
    }

    get type(): TileType { return this._type; } 

    toString(): string {
        return `[TileData type=${this.type}]`;
    }
}