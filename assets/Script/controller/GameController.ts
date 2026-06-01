// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import GameConfig from "../GameConfig";
import Board from "../model/Board";
import { BoosterType } from "../model/BoosterConfig";
import GameState from "../model/GameState";
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
    private _gameState: GameState | null = null;

    @property(cc.Node)
    boardNode: cc.Node | null = null;

    /** Узел с Sprite на весь экран; если пусто — ищется дочерний `background` у Canvas */
    @property(cc.Node)
    appBackgroundNode: cc.Node | null = null;

    @property(cc.SpriteFrame)
    appBgMobile: cc.SpriteFrame | null = null;

    @property(cc.SpriteFrame)
    appBgDesktop: cc.SpriteFrame | null = null;

    /** GameState создаётся в start(); до этого обращение бросает ошибку. */
    private get gameState(): GameState {
        if (!this._gameState) {
            throw new Error("[GameController] GameState is not initialized.");
        }
        return this._gameState;
    }

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


        this.autoFitCanvas();
        this.applyAppBackground();
        //this.scheduleOnce(() => this.applyAppBackground(), 0);
    }

    start() {
        //this.applyAppBackground();
        this._board = new Board(GameConfig.COLS, GameConfig.ROWS);
        cc.log('[GameController] Board created:', this._board.toString());

        this._gameState = new GameState(GameConfig.WIN_SCORE, GameConfig.TOTAL_MOVES);

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

    private autoFitCanvas() {
        const canvas = this.node.getComponent(cc.Canvas);

        const designSize = cc.view.getDesignResolutionSize();
        cc.log('designSize', designSize);

        const screenSize = cc.view.getFrameSize();
        cc.log('screenSize', screenSize);

        /* Здесь нужно дорабатывать поэтому убрал

        // Сравниваем соотношения сторон дизайна и экрана устройства
        if (screenSize.width / screenSize.height > designSize.width / designSize.height) {
            // Экран шире -> подгоняем по высоте
            canvas.fitHeight = true;
            canvas.fitWidth = false;
        } else {
            // Экран уже -> подгоняем по ширине
            canvas.fitWidth = true;
            canvas.fitHeight = false;
        }
        */
        canvas.fitHeight = true; // Так проще
    }

    /** Фон приложения: мобильный / десктопный спрайт по `cc.sys.isMobile` */
    private applyAppBackground(): void {
        const bgNode = this.appBackgroundNode || this.node.getChildByName('background');
        if (!bgNode) {
            cc.warn('[GameController] Background node not found. Add child `background` with Sprite or assign appBackgroundNode.');
            return;
        }

        const sprite = bgNode.getComponent(cc.Sprite);
        if (!sprite) {
            cc.warn('[GameController] Node for app background has no Sprite component.');
            return;
        }

        bgNode.color = cc.color(255, 255, 255);
        bgNode.opacity = 255;
        bgNode.zIndex = -1000;

        const parent = bgNode.parent;
        if (parent) {
            const cameraNode = parent.getChildByName('Main Camera');
            const targetIndex = cameraNode ? cameraNode.getSiblingIndex() + 1 : 0;
            bgNode.setSiblingIndex(targetIndex);
        }

        const frame = cc.sys.isMobile ? this.appBgMobile : this.appBgDesktop;
        if (frame) {
            sprite.spriteFrame = frame;
            cc.log(`[GameController] App background: ${cc.sys.isMobile ? 'mobile' : 'desktop'}`);
        } else {
            cc.warn(
                `[GameController] Assign appBgMobile and appBgDesktop in Inspector (missing: ${cc.sys.isMobile ? 'appBgMobile' : 'appBgDesktop'}).`
            );
        }
    }


    private refreshHud(): void {
        if (!this._hudView) {
            return;
        }

        this._hudView.render(this.gameState);
    }

    private onUseBooster(type: BoosterType): boolean {
        if (!this._board || !this._boardView || !this.gameState.isPlaying) {
            return false;
        }

        if (this._boardView.isAnimating || this._isShuffling) {
            return false;
        }

        if (type === BoosterType.BOMB || type === BoosterType.TELEPORT) {
            return this.toggleArmedBooster(type);
        }

        cc.warn("[GameController] Unknown booster type used.");
        return false;
    }

    private toggleArmedBooster(type: BoosterType): boolean {
        const wasArmed = this.gameState.isArmed(type);
        this.gameState.toggleBooster(type);
        this.syncArmedBoosterToView();

        if (wasArmed) {
            cc.log(`[GameController] ${type} cancelled.`);
        } else if (this.gameState.isArmed(type)) {
            cc.log(`[GameController] ${type} armed.`);
        }

        return false;
    }

    private refreshBoostersUi(): void {
        if (!this._boostersView) {
            return;
        }

        this._boostersView.render(this.gameState.boosters, this.gameState.armedBooster);
    }

    private syncArmedBoosterToView(): void {
        this.refreshBoostersUi();

        const armed = this.gameState.armedBooster;
        this._boardView?.setTeleportMode(
            armed === BoosterType.TELEPORT,
            armed === BoosterType.TELEPORT
                ? (fromCol, fromRow, toCol, toRow) => this.applyTeleportSwap(fromCol, fromRow, toCol, toRow)
                : null
        );
    }

    private disarmBooster(): void {
        this.gameState.disarm();
        this.syncArmedBoosterToView();
    }

    private onTileClicked(col: number, row: number): void {
        if (!this._board || !this._boardView || !this.gameState.isPlaying) {
            return;
        }

        if (this._boardView.isAnimating || this._isShuffling) {
            return;
        }

        if (this.gameState.isArmed(BoosterType.BOMB)) {
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
                this.gameState.boosters.consume(BoosterType.BOMB);
                this.refreshBoostersUi();
                this.onBoosterFinished(score, "bomb");
            }
        );
    }

    private applyTeleportSwap(fromCol: number, fromRow: number, toCol: number, toRow: number): void {
        if (!this._board || !this._boardView || !this.gameState.isPlaying) {
            return;
        }

        if (this._boardView.isAnimating || this._isShuffling || !this.gameState.isArmed(BoosterType.TELEPORT)) {
            return;
        }

        const swapped = this._board.swapTiles(fromCol, fromRow, toCol, toRow);
        if (!swapped) {
            return;
        }

        this.disarmBooster();
        this.gameState.boosters.consume(BoosterType.TELEPORT);
        this.refreshBoostersUi();
        this._boardView.render(this._board);
        this.onBoosterFinished(0, "teleport");
    }

    private onMoveFinished(score: number, source: string): void {
        this.gameState.applyMove(score);
        cc.log(
            `[GameController] ${source} done: +${score}, score=${this.gameState.score}, moves=${this.gameState.movesRemaining}`
        );
        this.evaluateEndOfGame();
    }

    private onBoosterFinished(score: number, source: string): void {
        this.gameState.applyBooster(score);
        cc.log(
            `[GameController] ${source} done: +${score}, score=${this.gameState.score}, moves=${this.gameState.movesRemaining} (no move spent)`
        );
        this.evaluateEndOfGame();
    }

    private evaluateEndOfGame(): void {
        if (!this._board || !this._boardView) {
            return;
        }

        if (!this.gameState.isGameOver && !this._isShuffling) {
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
            this.gameState.setLose("There are no valid moves in the game");
            cc.log(`[GameController] LOSE: ${this.gameState.getLoseReason()}`);
            this.refreshHud();
            return;
        }

        this.scheduleOnce(() => this.runShuffleAttempt(attempt + 1), GameConfig.SHUFFLE_STEP_DELAY_SEC);
    }
}
