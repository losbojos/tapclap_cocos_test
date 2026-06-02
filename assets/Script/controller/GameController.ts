// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import GameConfig from "../GameConfig";
import Board from "../model/Board";
import { BoosterType } from "../model/BoosterConfig";
import GameSession from "../model/GameSession";
import AnimateEffects from "../view/AnimateEffects";
import BoardView from "../view/BoardView";
import BoostersView from "../view/BoostersView";
import HudView from "../view/HudView";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GameController extends cc.Component {

    private _board?: Board;
    private _boardView: BoardView | null = null;
    private _boostersView: BoostersView | null = null;
    private _hudView: HudView | null = null;
    private _isShuffling: boolean = false;
    private _session: GameSession | null = null;

    @property(cc.Node)
    boardNode: cc.Node | null = null;

    onLoad() {
        cc.log('[GameController] ready');

        if (!this._boardView && this.boardNode) {
            this._boardView = this.boardNode.getComponent(BoardView);
        }

        if (!this._hudView) {
            const headerNode = this.node.getChildByName('hudNode');
            this._hudView = headerNode ? headerNode.getComponent(HudView) : null;
        }

        if (!this._boostersView) {
            const boostersNode = this.node.getChildByName("boostersNode");
            this._boostersView = boostersNode ? boostersNode.getComponent(BoostersView) : null;
        }

    }

    start() {
        this._board = new Board(GameConfig.COLS, GameConfig.ROWS);
        cc.log('[GameController] Board created:', this._board.toString());

        this._session = new GameSession(GameConfig.WIN_SCORE, GameConfig.TOTAL_MOVES);

        if (!this._boardView) {
            cc.error('[GameController] BoardView not found. Add BoardView to boardNode, assign in Inspector, save scene.');
            return;
        }

        if (!this._hudView) {
            cc.warn('[GameController] HudView not found. Add HudView to header and assign labels.');
        } else {
            this.refreshHud();
        }
        
        if (this._boostersView) {
            this._boostersView.init((type) => this.onUseBooster(type));
            this.refreshBoostersUi();
        } else {
            cc.warn('[GameController] BoostersView not found. Add BoostersView to boostersNode.');
        }

        this._boardView.setOnTileClick((col, row) => this.onTileClicked(col, row));
        this._boardView.setTeleportMode(false, null);
        this._boardView.render(this._board);
        this.evaluateEndOfGame();
    }

    private get session(): GameSession {
        if (!this._session) {
            throw new Error("[GameController] GameSession is not initialized.");
        }
        return this._session;
    }

    private canInteractWithBoard(): boolean {
        if (!this._board || !this._boardView || !this._session) {
            return false;
        }

        if (!this._session.isPlaying) {
            return false;
        }

        if (this._boardView.isAnimating || this._isShuffling) {
            return false;
        }

        return true;
    }

    private refreshHud(): void {
        if (!this._hudView) {
            return;
        }

        this._hudView.render(this.session);
    }

    private onUseBooster(type: BoosterType): boolean {
        if (!this.canInteractWithBoard()) {
            return false;
        }

        if (type === BoosterType.BOMB || type === BoosterType.TELEPORT) {
            return this.toggleArmedBooster(type);
        }

        cc.warn("[GameController] Unknown booster type used.");
        return false;
    }

    private toggleArmedBooster(type: BoosterType): boolean {
        const wasArmed = this.session.isArmed(type);
        this.session.toggleBooster(type);
        this.syncArmedBoosterToView();

        if (wasArmed) {
            cc.log(`[GameController] ${type} cancelled.`);
        } else if (this.session.isArmed(type)) {
            cc.log(`[GameController] ${type} armed.`);
        }

        return false;
    }

    private refreshBoostersUi(): void {
        if (!this._boostersView) {
            return;
        }

        this._boostersView.render(this.session.boosters, this.session.armedBooster);
    }

    private syncArmedBoosterToView(): void {
        this.refreshBoostersUi();

        const armed = this.session.armedBooster;
        this._boardView?.setTeleportMode(
            armed === BoosterType.TELEPORT,
            armed === BoosterType.TELEPORT
                ? (fromCol, fromRow, toCol, toRow) => this.applyTeleportSwap(fromCol, fromRow, toCol, toRow)
                : null
        );
    }

    private disarmBooster(): void {
        this.session.disarm();
        this.syncArmedBoosterToView();
    }

    private onTileClicked(col: number, row: number): void {
        if (!this.canInteractWithBoard()) {
            return;
        }

        if (this.session.isArmed(BoosterType.BOMB)) {
            this.applyBombAt(col, row);
            return;
        }

        const group = this._board.findGroup(col, row);
        if (!Board.isBlastableGroup(group)) {
            cc.log(`[GameController] click (${col}, ${row}): group too small (${group.length})`);
            return;
        }

        this._boardView.playBlast(this._board, group, (score) => {
            this.onMoveFinished(score, "blast");
        });
    }

    private applyBombAt(col: number, row: number): void {
        if (!this._board || !this._boardView) {
            return;
        }

        const cells = this._board.getCellsInRadius(col, row, GameConfig.BOMB_RADIUS);
        this.disarmBooster();

        this._boardView.playBombBlast(
            this._board,
            cells,
            col,
            row,
            (area) => this._board!.removeCells(area),
            (score) => {
                this.session.boosters.consume(BoosterType.BOMB);
                this.refreshBoostersUi();
                this.onBoosterFinished(score, "bomb");
            }
        );
    }

    private applyTeleportSwap(fromCol: number, fromRow: number, toCol: number, toRow: number): void {
        if (!this.canInteractWithBoard() || !this.session.isArmed(BoosterType.TELEPORT)) {
            return;
        }

        const swapped = this._board.swapTiles(fromCol, fromRow, toCol, toRow);
        if (!swapped) {
            return;
        }

        this.disarmBooster();
        this.session.boosters.consume(BoosterType.TELEPORT);
        this.refreshBoostersUi();
        this._boardView.render(this._board);
        this.onBoosterFinished(0, "teleport");
    }

    private onMoveFinished(score: number, source: string): void {
        this.session.applyMove(score);
        cc.log(
            `[GameController] ${source} done: +${score}, score=${this.session.score}, moves=${this.session.movesRemaining}`
        );
        this.evaluateEndOfGame();
    }

    private onBoosterFinished(score: number, source: string): void {
        this.session.applyBooster(score);
        cc.log(
            `[GameController] ${source} done: +${score}, score=${this.session.score}, moves=${this.session.movesRemaining} (no move spent)`
        );
        this.evaluateEndOfGame();
    }

    private evaluateEndOfGame(): void {
        if (!this._board || !this._boardView) {
            return;
        }

        if (!this.session.isGameOver && !this._isShuffling) {
            if (!this._board.hasAnyBlastableMove()) {
                this._isShuffling = true;
                this.runShuffleAttempt(1);
            }
        }

        this.refreshHud();
    }

    private runShuffleAttempt(attempt: number): void {
        if (!this._board || !this._boardView) {
            this._isShuffling = false;
            return;
        }

        this._board.shuffleTiles();
        AnimateEffects.shakeNodeX(this.boardNode, 18, Math.min(0.05, GameConfig.SHUFFLE_STEP_DELAY_SEC / 6));
        this._boardView.render(this._board);

        cc.log(`[GameController] Shuffle ${attempt}/${GameConfig.MAX_SHUFFLE_ATTEMPTS}`);

        if (this._board.hasAnyBlastableMove()) {
            this._isShuffling = false;
            cc.log(`[GameController] Shuffle complete: valid moves found on attempt ${attempt}.`);
            this.refreshHud();
            return;
        }

        if (attempt >= GameConfig.MAX_SHUFFLE_ATTEMPTS) {
            this._isShuffling = false;
            this.session.setLose("There are no valid moves in the game");
            cc.log(`[GameController] LOSE: ${this.session.getLoseReason()}`);
            this.refreshHud();
            return;
        }

        this.scheduleOnce(() => this.runShuffleAttempt(attempt + 1), GameConfig.SHUFFLE_STEP_DELAY_SEC);
    }
}
