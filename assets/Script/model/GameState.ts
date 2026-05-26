import GameConfig from "../GameConfig";
import { GameStatus } from "./GameStatus";

export default class GameState {
    private readonly _goal: number; 
    private readonly _movesLimit: number;

    private _score: number = 0;
    private _movesRemaining: number = GameConfig.TOTAL_MOVES;
    private _status: GameStatus = GameStatus.Playing;
    private _loseReason: string = "";

    constructor(goal: number, movesLimit: number) {
        this._goal = goal;
        this._movesLimit = movesLimit;

        this._score = 0;
        this._movesRemaining = movesLimit;

        this._status = GameStatus.Playing;
    }

    get goal(): number {
        return this._goal;
    }

    get movesLimit(): number {
        return this._movesLimit;
    }

    get score(): number {
        return this._score;
    }

    get movesRemaining(): number {
        return this._movesRemaining;
    }

    get status(): GameStatus {
        return this._status;
    }

    get isPlaying(): boolean {
        return this._status === GameStatus.Playing;
    }

    applyMove(points: number): GameStatus {
        if (!this.isPlaying) {
            throw new Error("Invalid move after game is over");
        }

        if (this._movesRemaining <= 0) {
            throw new Error("No moves remaining");
        }

        this._score += points;
        this._movesRemaining--;

        if (this._score >= this._goal) {
            this._status = GameStatus.Won;
        } else if (this._movesRemaining <= 0) {
            this.setLose("No moves remaining");
        }

        return this._status;
    }

    get isGameOver(): boolean {
        return this._status === GameStatus.Won || this._status === GameStatus.Lost;
    }

    get isWin(): boolean {
        return this._status === GameStatus.Won;
    }

    get isLose(): boolean {
        return this._status === GameStatus.Lost;
    }

    setLose(reason: string) {
        if (this._status !== GameStatus.Playing) {
            throw new Error("Cannot set lose reason after game is over");
        }

        this._status = GameStatus.Lost;
        this._loseReason = reason;
    }

    getLoseReason(): string {
        if (this._status === GameStatus.Lost) {
            return this._loseReason;
        }

        return "";
    }
}
