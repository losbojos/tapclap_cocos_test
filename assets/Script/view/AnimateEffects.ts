export type BombTileAnimEntry = {
    node: cc.Node;
    waveDelaySec: number;
    baseScale: number;
};

type ParticlePreset = {
    total: number;
    duration: number;
    rate: number;
    life: number;
    speed: number;
    startSize: number;
    endSize: number;
    startColor: cc.Color;
    endColor: cc.Color;
    gravityY: number;
    radialAccel: number;
    additive: boolean;
};

const BOMB_SPARKS: ParticlePreset = {
    total: 140,
    duration: 0.28,
    rate: 360,
    life: 0.75,
    speed: 250,
    startSize: 16,
    endSize: 1,
    startColor: cc.color(255, 245, 130, 255),
    endColor: cc.color(255, 90, 30, 0),
    gravityY: -320,
    radialAccel: 90,
    additive: true,
};

const BOMB_DEBRIS: ParticlePreset = {
    total: 60,
    duration: 0.24,
    rate: 180,
    life: 0.95,
    speed: 130,
    startSize: 24,
    endSize: 30,
    startColor: cc.color(180, 120, 70, 180),
    endColor: cc.color(80, 60, 50, 0),
    gravityY: -90,
    radialAccel: 30,
    additive: false,
};

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

    static explodeNodesFromCenter(
        entries: BombTileAnimEntry[],
        center: cc.Vec2,
        durationSec: number,
        flyDistancePx: number,
        onAllDone: () => void
    ): void {
        if (entries.length === 0) {
            onAllDone();
            return;
        }

        let remaining = entries.length;
        const popSec = durationSec * 0.18;
        const flySec = durationSec * 0.82;

        entries.forEach(({ node, waveDelaySec, baseScale }) => {
            const pos = node.getPosition();
            let nx = pos.x - center.x;
            let ny = pos.y - center.y;
            const len = Math.hypot(nx, ny);

            if (len < 1) {
                const angle = Math.random() * Math.PI * 2;
                nx = Math.cos(angle);
                ny = Math.sin(angle);
            } else {
                nx /= len;
                ny /= len;
            }

            cc.tween(node)
                .delay(waveDelaySec)
                .to(popSec, { scale: baseScale * 1.35 }, { easing: "quadOut" })
                .to(flySec, {
                    x: pos.x + nx * flyDistancePx,
                    y: pos.y + ny * flyDistancePx,
                    scale: baseScale * 0.15,
                    opacity: 0,
                    angle: (Math.random() > 0.5 ? 1 : -1) * (35 + Math.random() * 45),
                }, { easing: "quadIn" })
                .call(() => {
                    node.destroy();
                    if (--remaining === 0) {
                        onAllDone();
                    }
                })
                .start();
        });
    }

    /** Кольцо, вспышка и частицы по всей зоне взрыва. */
    static playBombEffect(
        layer: cc.Node,
        spriteFrame: cc.SpriteFrame,
        areaCenter: cc.Vec2,
        areaHalfSize: cc.Vec2,
        ringDiameterPx: number,
        ringDurationSec: number
    ): void {
        AnimateEffects.tweenShockwaveSprite(
            layer, spriteFrame, areaCenter, ringDiameterPx,
            cc.color(255, 210, 90), 210, 0.15, ringDurationSec, 1.15
        );
        AnimateEffects.tweenShockwaveSprite(
            layer, spriteFrame, areaCenter, ringDiameterPx * 0.35,
            cc.Color.WHITE, 255, 0.4, ringDurationSec * 0.45, 1.6
        );
        AnimateEffects.emitParticles(layer, spriteFrame, areaCenter, areaHalfSize, BOMB_SPARKS);
        AnimateEffects.emitParticles(layer, spriteFrame, areaCenter, areaHalfSize, BOMB_DEBRIS);
    }

    private static tweenShockwaveSprite(
        layer: cc.Node,
        spriteFrame: cc.SpriteFrame,
        pos: cc.Vec2,
        size: number,
        color: cc.Color,
        opacity: number,
        startScale: number,
        durationSec: number,
        endScale: number
    ): void {
        const node = new cc.Node("bomb_visual_effect");
        const sprite = node.addComponent(cc.Sprite);
        sprite.spriteFrame = spriteFrame;
        node.color = color;
        node.setContentSize(size, size);
        node.setPosition(pos);
        node.opacity = opacity;
        node.setScale(startScale);
        layer.addChild(node);

        cc.tween(node)
            .to(durationSec, { scale: endScale, opacity: 0 }, { easing: "sineOut" })
            .call(() => node.destroy())
            .start();
    }

    private static emitParticles(
        layer: cc.Node,
        spriteFrame: cc.SpriteFrame,
        pos: cc.Vec2,
        areaHalfSize: cc.Vec2,
        preset: ParticlePreset
    ): void {
        const node = new cc.Node("bomb_particles");
        node.setPosition(pos);
        layer.addChild(node);

        const ps = node.addComponent(cc.ParticleSystem);
        ps.custom = true;
        ps.spriteFrame = spriteFrame;
        ps.playOnLoad = false;
        ps.autoRemoveOnFinish = true;
        ps.totalParticles = preset.total;
        ps.duration = preset.duration;
        ps.emissionRate = preset.rate;
        ps.life = preset.life;
        ps.lifeVar = preset.life * 0.25;
        ps.posVar = areaHalfSize;
        ps.angle = 90;
        ps.angleVar = 360;
        ps.speed = preset.speed;
        ps.speedVar = preset.speed * 0.45;
        ps.startSize = preset.startSize;
        ps.startSizeVar = preset.startSize * 0.6;
        ps.endSize = preset.endSize;
        ps.endSizeVar = preset.endSize * 0.3;
        ps.startColor = preset.startColor;
        ps.endColor = preset.endColor;
        ps.emitterMode = cc.ParticleSystem.EmitterMode.GRAVITY;
        ps.gravity = cc.v2(0, preset.gravityY);
        ps.radialAccel = preset.radialAccel;
        ps.positionType = cc.ParticleSystem.PositionType.FREE;
        ps.srcBlendFactor = cc.macro.BlendFactor.SRC_ALPHA;
        ps.dstBlendFactor = preset.additive
            ? cc.macro.BlendFactor.ONE
            : cc.macro.BlendFactor.ONE_MINUS_SRC_ALPHA;
        ps.resetSystem();
    }
}
