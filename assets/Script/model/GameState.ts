import GameConfig from "../GameConfig";
import { BoosterType } from "./BoosterConfig";
import BoosterInventory from "./BoosterInventory";
import { GameStatus } from "./GameStatus";


/** Состояние текущей игры (сессии). */
export default class GameState {
    private readonly _goal: number; 
    private readonly _movesLimit: number;
    private readonly _boosters = new BoosterInventory();

    private _score: number = 0;
    private _movesRemaining: number = GameConfig.TOTAL_MOVES;
    private _status: GameStatus = GameStatus.Playing;
    private _loseReason: string = "";
    private _armedBooster: BoosterType | null = null;

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

    get boosters(): BoosterInventory {
        return this._boosters;
    }

    get armedBooster(): BoosterType | null {
        return this._armedBooster;
    }

    isArmed(type: BoosterType): boolean {
        return this._armedBooster === type;
    }

    arm(type: BoosterType): boolean {
        if (!this._boosters.canUse(type)) {
            return false;
        }

        this._armedBooster = type;
        return true;
    }

    disarm(): void {
        this._armedBooster = null;
    }

    /** Взвести бустер или снять взведение, если уже выбран этот тип. */
    toggleBooster(type: BoosterType): void {
        if (this._armedBooster === type) {
            this.disarm();
            return;
        }

        this.arm(type);
    }

    /** Ход с доски: очки + списание одного хода. */
    applyMove(points: number): GameStatus {
        if (!this.isPlaying) {
            throw new Error("Invalid move after game is over");
        }

        if (this._movesRemaining <= 0) {
            throw new Error("No moves remaining");
        }

        this.addScore(points);
        this._movesRemaining--;

        if (this._movesRemaining <= 0 && this.isPlaying) {
            this.setLose("No moves remaining");
        }

        return this._status;
    }

    /** Успешный бустер: очки (если есть), ход не тратится. */
    applyBooster(points: number): GameStatus {
        if (!this.isPlaying) {
            throw new Error("Invalid booster after game is over");
        }

        this.addScore(points);
        return this._status;
    }

    private addScore(points: number): void {
        this._score += points;

        if (this._score >= this._goal) {
            this._status = GameStatus.Won;
            this.disarm();
        }
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
        this.disarm();
    }

    getLoseReason(): string {
        if (this._status === GameStatus.Lost) {
            return this._loseReason;
        }

        return "";
    }
}
