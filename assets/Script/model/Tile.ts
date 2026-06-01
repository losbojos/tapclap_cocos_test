import { TileType } from "./TileType";

export default class Tile {
    private _type: TileType;
 
    constructor(type: TileType) {
        this._type = type;
    }

    get type(): TileType { return this._type; }

    /** Эквивалентны ли два тайла? Совпадает ли тип и значимые свойства. */
    isEqual(other: Tile): boolean {
        return this.type === other.type;
    }

    toString(): string {
        return `[TileData type=${this.type}]`;
    }
}