// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import GameConfig from "../GameConfig";
import Board from "../model/Board";
import GameState from "../model/GameState";
import BoardView from "../view/BoardView";
import HudView from "../view/HudView";

const { ccclass, property } = cc._decorator;

@ccclass
export default class GameController extends cc.Component {

    private _board?: Board;
    private _boardView: BoardView | null = null;
    private _hud: HudView | null = null;
    private readonly _gameState = new GameState(GameConfig.WIN_SCORE, GameConfig.TOTAL_MOVES);

    @property(cc.Node)
    boardNode: cc.Node | null = null;

    @property(HudView)
    hud: HudView | null = null;

    onLoad() {
        cc.log('[GameController] ready');

        if (!this._boardView && this.boardNode) {
            this._boardView = this.boardNode.getComponent(BoardView);
        }

        this._hud = this.hud || this.getComponent(HudView);
        if (!this._hud) {
            this._hud = this.addComponent(HudView);
        }
        this.bindHudLabelFromScene();
    }

    start() {
        this._board = new Board(GameConfig.COLS, GameConfig.ROWS);
        cc.log('[GameController] Board created:', this._board.toString());

        if (!this._boardView) {
            cc.error('[GameController] BoardView not found. Add BoardView to boardNode, assign in Inspector, save scene.');
            return;
        }

        if (!this._hud) {
            cc.warn('[GameController] HudView not found. Add HudView to Canvas and assign infoLabel.');
        }

        this._boardView.setOnTileClick((col, row) => this.onTileClicked(col, row));
        this._boardView.render(this._board);
        this.evaluateEndOfGame();
    }

    private bindHudLabelFromScene(): void {
        if (!this._hud || this._hud.infoLabel) {
            return;
        }

        const labelNode = this.node.getChildByName('label');
        if (!labelNode) {
            return;
        }

        const label = labelNode.getComponent(cc.Label);
        if (label) {
            this._hud.infoLabel = label;
        }
    }

    private refreshHud(): void {
        if (this._hud) {
            this._hud.render(this._gameState);
        }
    }

    private onTileClicked(col: number, row: number): void {
        if (!this._board || !this._boardView || !this._gameState.isPlaying) {
            return;
        }

        if (this._boardView.isAnimating) {
            return;
        }

        const group = this._board.findGroup(col, row);
        if (!Board.isBlastableGroup(group)) {
            cc.log(`[GameController] click (${col}, ${row}): group too small (${group.length})`);
            return;
        }

        this._boardView.playBlast(this._board, group, (score) => {
            this._gameState.applyMove(score);
            this.evaluateEndOfGame();
            cc.log(
                `[GameController] blast done: +${score}, score=${this._gameState.score}, moves=${this._gameState.movesRemaining}`
            );
        });
    }

    private evaluateEndOfGame(): void {
        if (!this._board) {
            return;
        }

        if (!this._gameState.isGameOver) {
            if (!this._board.hasAnyBlastableMove()) {
                this._gameState.setLose("There are no valid moves in the game");
                cc.log(`[GameController] LOSE: ${this._gameState.getLoseReason()}`);
            }
        }

        this.refreshHud();
    }
}
