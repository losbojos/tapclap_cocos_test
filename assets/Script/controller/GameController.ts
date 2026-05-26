// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import GameConfig from "../GameConfig";
import Board from "../model/Board";
import BoardView from "../view/BoardView";

const {ccclass, property} = cc._decorator;

@ccclass
export default class GameController extends cc.Component {

    private _board?: Board;
    private _boardView: BoardView | null = null;

    @property(cc.Node)
    boardNode: cc.Node | null = null; // Узел сцены с BoardView (игровое поле)

    onLoad() {
        cc.log('[GameController] ready');

        if (!this._boardView && this.boardNode) {
            this._boardView = this.boardNode.getComponent(BoardView);
        }
    }

    start() {
        this._board = new Board(GameConfig.COLS, GameConfig.ROWS);
        cc.log('[GameController] Board created:', this._board.toString());

        if (!this._boardView) {
            cc.error('[GameController] BoardView not found. Add BoardView to boardNode, assign in Inspector, save scene.');
            return;
        }

        this._boardView.setOnTileClick((col, row) => this.onTileClicked(col, row));
        this._boardView.render(this._board);
    }

    private onTileClicked(col: number, row: number): void {
        if (!this._board || !this._boardView) {
            return;
        }

        const group = this._board.findGroup(col, row);
        if (!Board.isBlastableGroup(group)) {
            cc.log(`[GameController] click (${col}, ${row}): group too small (${group.length})`);
            return;
        }

        const score = this._board.blast(group);
        this._boardView.render(this._board);
        cc.log(`[GameController] blasted ${group.length} tiles, +${score} score`);
    }

    // update (dt) {}
}
