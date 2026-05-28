export default class AnimateEffects {

    static shakeNodeX(target: cc.Node | null, amplitudePx: number, stepSec: number): void {
        if (!target) {
            return;
        }        

        const baseX = target.x;
        const baseY = target.y;

        cc.Tween.stopAllByTarget(target);
        target.setPosition(baseX, baseY);
        cc.tween(target)
            .to(stepSec, { x: baseX - amplitudePx, y: baseY })
            .to(stepSec, { x: baseX + amplitudePx, y: baseY })
            .to(stepSec, { x: baseX - amplitudePx * 0.6, y: baseY })
            .to(stepSec, { x: baseX + amplitudePx * 0.6, y: baseY })
            .to(stepSec, { x: baseX, y: baseY })
            .start();
    }
}
