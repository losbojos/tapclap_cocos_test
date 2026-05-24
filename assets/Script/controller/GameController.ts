// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import Board from "../model/Board";
import BoardView from "../view/BoardView";

const {ccclass, property} = cc._decorator;

@ccclass
export default class GameController extends cc.Component {

    private _board?: Board;

    @property(cc.Node)
    field?: cc.Node;

    @property(BoardView)
    boardView?: BoardView;

    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        cc.log('[GameController] ready');

        if (!this.boardView && this.field) {
            this.boardView = this.field.getComponent(BoardView);
        }
    }

    start() {
        this._board = new Board(10, 10);
        cc.log('[GameController] Board created:', this._board.toString());

        if (!this.boardView) {
            cc.error('[GameController] BoardView не найден. На Field: Add Component → BoardView, сохранить сцену.');
            return;
        }

        this.boardView.render(this._board);
    }    

    // update (dt) {}
}
