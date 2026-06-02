const { ccclass, property } = cc._decorator;

/** Фон приложения: mobile / desktop спрайт и порядок отрисовки под UI. */
@ccclass
export default class AppBackgroundView extends cc.Component {
    @property(cc.SpriteFrame)
    bgMobile: cc.SpriteFrame | null = null;

    @property(cc.SpriteFrame)
    bgDesktop: cc.SpriteFrame | null = null;

    onLoad(): void {
        const sprite = this.getComponent(cc.Sprite);
        if (!sprite) {
            cc.warn("[AppBackgroundView] Add cc.Sprite on the same node as this component.");
            return;
        }

        this.node.zIndex = -1000;
       
        const frame = cc.sys.isMobile ? this.bgMobile : this.bgDesktop;
        if (frame) {
            sprite.spriteFrame = frame;
            cc.log(`[AppBackgroundView] ${cc.sys.isMobile ? "mobile" : "desktop"} background applied.`);
        } else {
            cc.warn(
                `[AppBackgroundView] Assign bgMobile and bgDesktop in Inspector (missing: ${
                    cc.sys.isMobile ? "bgMobile" : "bgDesktop"
                }).`
            );
        }
    }
}
