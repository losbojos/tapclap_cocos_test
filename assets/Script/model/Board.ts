import GameConfig from "../GameConfig";
import Utils from "../utils/Utils";
import NormalTile from "./NormalTile";
import { TileColor } from "./TileColor";
import Tile from "./Tile";

export interface BoardCell {
    col: number;
    row: number;
}

export default class Board {
    private _colCount: number;
    private _rowCount: number;
    private _tiles: Tile[][];

    constructor(colCount: number, rowCount: number) {
        this._colCount = colCount;
        this._rowCount = rowCount;
        this._tiles = [];

        for (let x = 0; x < colCount; x++) {
            this._tiles[x] = [];
            for (let y = 0; y < rowCount; y++) {
                this._tiles[x][y] = new NormalTile(Utils.getRandomEnumValue(TileColor));
            }
        }
    }

    getTile(col: number, row: number): Tile|null {
        if (!this.isInBounds(col, row)) {
            return null;
        }
        return this._tiles[col][row];
    }

    get colCount(): number {
        return this._colCount;
    }

    get rowCount(): number {
        return this._rowCount;
    }

    /** Соседняя группа того же цвета (4-связность), только NormalTile. */
    findGroup(col: number, row: number): BoardCell[] {
        const startTile = this.getTile(col, row);
        if (!(startTile instanceof NormalTile)) {
            return [];
        }

        const targetColor = startTile.color;
        const group: BoardCell[] = [];
        const visited = new Set<string>();
        const queue: BoardCell[] = [{ col, row }];

        visited.add(Board.cellKey(col, row));

        while (queue.length > 0) {
            const cell = queue.shift()!;
            const tile = this.getTile(cell.col, cell.row);

            if (!(tile instanceof NormalTile) || tile.color !== targetColor) {
                continue;
            }

            group.push(cell);

            for (const [dc, dr] of Board.NEIGHBOR_DELTAS) {
                const nc = cell.col + dc;
                const nr = cell.row + dr;

                if (!this.isInBounds(nc, nr)) {
                    continue;
                }

                const key = Board.cellKey(nc, nr);

                if (visited.has(key)) {
                    continue;
                }

                const neighbor = this.getTile(nc, nr);
                if (neighbor instanceof NormalTile && neighbor.color === targetColor) {
                    visited.add(key);
                    queue.push({ col: nc, row: nr });
                }
            }
        }

        return group;
    }

    static isBlastableGroup(group: BoardCell[]): boolean {
        return group.length >= GameConfig.MIN_BLAST_GROUP_SIZE;
    }

    /** Есть ли на поле хотя бы одна группа для сжигания. */
    hasAnyBlastableMove(): boolean {
        for (let col = 0; col < this._colCount; col++) {
            for (let row = 0; row < this._rowCount; row++) {
                if (Board.isBlastableGroup(this.findGroup(col, row))) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Сжигает группу, ссыпает тайлы вниз (row 0 — низ поля), заполняет пустоты сверху.
     * @returns очки за ход (0, если группа невалидна)
     */
    blast(group: BoardCell[]): number {
        if (!Board.isBlastableGroup(group)) {
            return 0;
        }

        const toRemove = new Set(
            group.map(cell => Board.cellKey(cell.col, cell.row))
        );

        for (let col = 0; col < this._colCount; col++) {
            this.compactColumn(col, toRemove);
        }

        return group.length * GameConfig.ONE_TILE_SCORE;
    }

    private compactColumn(col: number, toRemove: Set<string>): void {
        const remaining: Tile[] = [];

        for (let row = 0; row < this._rowCount; row++) {
            const key = Board.cellKey(col, row);
            if (!toRemove.has(key)) {
                remaining.push(this._tiles[col][row]);
            }
        }

        for (let row = 0; row < this._rowCount; row++) {
            if (row < remaining.length) {
                this._tiles[col][row] = remaining[row];
            } else {
                this._tiles[col][row] = new NormalTile(Utils.getRandomEnumValue(TileColor));
            }
        }
    }

    private static readonly NEIGHBOR_DELTAS: ReadonlyArray<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ];

    private isInBounds(col: number, row: number): boolean {
        return col >= 0 && col < this._colCount && row >= 0 && row < this._rowCount;
    }

    private static cellKey(col: number, row: number): string {
        return `${col},${row}`;
    }

    toString(): string {
        return `[Board width=${this._colCount}, height=${this._rowCount}]`;
    }
}