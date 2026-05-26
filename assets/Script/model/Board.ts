import Utils from "../utils/Utils";
import NormalTile from "./NormalTile";
import { TileColor } from "./TileColor";
import Tile from "./Tile";

export default class Board {
    private _width: number;
    private _height: number;
    private _tiles: Tile[][];

    constructor(width: number, height: number) {
        this._width = width;
        this._height = height;
        this._tiles = [];

        for (let x = 0; x < width; x++) {
            this._tiles[x] = [];
            for (let y = 0; y < height; y++) {
                this._tiles[x][y] = new NormalTile(Utils.getRandomEnumValue(TileColor));
            }
        }
    }

    getTile(col: number, row: number): Tile|null {
        if (col < 0 || col >= this._width) return null;
        if (row < 0 || row >= this._height) return null;
        return this._tiles[col][row];
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    toString(): string {
      return `[Board width=${this._width}, height=${this._height}]`;
  }
}