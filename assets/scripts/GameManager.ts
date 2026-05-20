import {
    _decorator,
    AudioClip,
    AudioSource,
    Color,
    Component,
    input,
    Input,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    resources,
    sys,
    UITransform,
    Vec3,
    view,
} from 'cc';

const { ccclass, property } = _decorator;

type GameState = 'ready' | 'playing' | 'gameOver';

interface PipePair {
    root: Node;
    top: Node;
    bottom: Node;
    coins: Node[];
    scored: boolean;
    topBreaking: boolean;
    bottomBreaking: boolean;
    topGone: boolean;
    bottomGone: boolean;
}

@ccclass('GameManager')
export class GameManager extends Component {
    @property(SpriteFrame)
    public bgFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public landFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public pipeUpFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public pipeDownFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public hpFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public coinFrame: SpriteFrame | null = null;

    @property([SpriteFrame])
    public coinFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public birdFrames: SpriteFrame[] = [];

    private readonly bestScoreKey = 'flappy_best_score';
    private readonly coinScoreKey = 'flappy_coin_score';

    private state: GameState = 'ready';
    private world: Node | null = null;
    private pipeLayer: Node | null = null;
    private bird: Node | null = null;
    private hudLayer: Node | null = null;
    private hpLayer: Node | null = null;
    private scoreLabel: Label | null = null;
    private bestLabel: Label | null = null;
    private coinScoreLabel: Label | null = null;
    private tipLabel: Label | null = null;
    private hpTextLabel: Label | null = null;
    private audioSource: AudioSource | null = null;
    private hitClip: AudioClip | null = null;
    private lands: Node[] = [];
    private hpNodes: Node[] = [];
    private pipes: PipePair[] = [];

    private score = 0;
    private coinScore = 0;
    private bestScore = 0;
    private lives = 3;
    private birdVelocity = 0;
    private pipeTimer = 0;
    private birdAnimTimer = 0;
    private birdFrameIndex = 0;
    private coinAnimTimer = 0;
    private invincibleTimer = 0;
    private hitSoundTimer = 0;
    private screenWidth = 0;
    private screenHeight = 0;

    private birdScale = 1.8;
    private landScale = 2;
    private pipeScale = 2;
    private landHeight = 224;
    private landWidth = 672;
    private floorY = -336;
    private birdHeight = 86.4;
    private gapHeight = 259.2;
    private pipeWidth = 104;
    private pipeHeight = 640;
    private coinSize = 43.2;
    private coinGapRatio = 0.2;
    private coinFrameWidth = 162;
    private coinFrameHeight = 161;

    private gravity = -1700;
    private jumpVelocity = 640;
    private pipeSpeed = 220;
    private pipeInterval = 1.55;
    private landOffsetY = -80;
    private maxLives = 3;
    private invincibleDuration = 1;
    private pipeBreakSpeed = 820;
    private groundBounceVelocity = 860;
    private hpIconScale = 0.32;
    private hitSoundCooldown = 0.08;
    private hitSoundVolume = 0.85;
    private coinAnimDuration = 0.5;

    protected onLoad(): void {
        this.refreshScreenSize();
        this.audioSource = getOrAddComponent(this.node, AudioSource);
        this.loadHitSound();
        this.bestScore = Number.parseInt(sys.localStorage.getItem(this.bestScoreKey) || '0', 10) || 0;
        this.coinScore = Number.parseInt(sys.localStorage.getItem(this.coinScoreKey) || '0', 10) || 0;
        this.createScene();
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onTouchStart, this);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onTouchStart, this);
    }

    protected update(deltaTime: number): void {
        if (!this.bird) {
            return;
        }

        this.refreshScreenSize();
        this.layoutHud();
        this.hitSoundTimer = Math.max(0, this.hitSoundTimer - deltaTime);
        this.updateBirdAnimation(deltaTime);

        if (this.state === 'ready') {
            this.bird.setPosition(this.bird.position.x, Math.sin(Date.now() * 0.006) * 16 + 120);
            return;
        }

        if (this.state !== 'playing') {
            return;
        }

        this.updateBirdPhysics(deltaTime);
        this.updateInvincibility(deltaTime);
        this.updateLand(deltaTime);
        this.updatePipes(deltaTime);
        this.checkCollisions();
    }

    private createScene(): void {
        this.refreshScreenSize();

        this.world = getOrCreateChild(this.node, 'World');

        this.createBackground();
        this.pipeLayer = getOrCreateChild(this.world, 'Pipes');
        const pipePreview = this.pipeLayer.getChildByName('PipePreview');
        if (pipePreview) {
            pipePreview.active = false;
        }
        this.createLand();
        this.createBird();
        this.createHud();
        this.resetGame();
        this.startGame();
    }

    private createBackground(): void {
        const bg = this.createSpriteNode('Background', this.bgFrame, this.world, 288, 512);
        const scale = Math.max(this.screenWidth / 288, this.screenHeight / 512);
        bg.setScale(scale, scale, 1);
    }

    private createLand(): void {
        this.landHeight = 112 * this.landScale;
        this.landWidth = 336 * this.landScale;
        this.floorY = -this.screenHeight / 2 + this.landHeight + this.landOffsetY;

        for (let i = 0; i < 2; i++) {
            const land = this.createSpriteNode(`Land_${i}`, this.landFrame, this.world, 336, 112);
            land.setScale(this.landScale, this.landScale, 1);
            land.setPosition(i * this.landWidth, this.floorY - this.landHeight / 2);
            this.lands.push(land);
        }
    }

    private createBird(): void {
        this.bird = this.createSpriteNode('Bird', this.birdFrames[0] || null, this.world, 48, 48);
        this.bird.setScale(this.birdScale, this.birdScale, 1);
        this.birdHeight = 48 * this.birdScale;
        this.gapHeight = this.birdHeight * 3;
        this.coinSize = this.birdHeight * 0.5;
    }

    private createHud(): void {
        const hudParent = this.world || this.node;
        this.removeOldCanvasHudNodes();
        this.hudLayer = getOrCreateChild(hudParent, 'HudLayer');
        this.hudLayer.active = true;
        this.hudLayer.layer = hudParent.layer;
        this.hudLayer.setPosition(0, 0, 0);
        getOrAddComponent(this.hudLayer, UITransform).setContentSize(this.screenWidth, this.screenHeight);

        this.scoreLabel = this.createLabel('ScoreLabel', '0', 72, new Vec3(0, 0, 0), this.hudLayer);
        this.bestLabel = this.createLabel('BestLabel', `Best ${this.bestScore}`, 34, new Vec3(0, 0, 0), this.hudLayer);
        this.coinScoreLabel = this.createLabel('CoinScoreLabel', 'Coin 0', 34, new Vec3(0, 0, 0), this.hudLayer);
        this.tipLabel = this.createLabel('TipLabel', '', 42, new Vec3(0, 0, 0), this.hudLayer);
        this.createHpHud();
        if (this.tipLabel) {
            this.tipLabel.node.active = false;
        }
        this.layoutHud();
    }

    private createHpHud(): void {
        const hpParent = this.hudLayer || this.world || this.node;
        this.hpLayer = getOrCreateChild(hpParent, 'HpLayer');

        const oldCanvasHpLayer = this.node.getChildByName('HpLayer');
        if (oldCanvasHpLayer && oldCanvasHpLayer !== this.hpLayer) {
            oldCanvasHpLayer.destroy();
        }

        this.hpLayer.active = true;
        this.hpLayer.layer = hpParent.layer;
        this.hpLayer.setPosition(0, 0, 0);
        getOrAddComponent(this.hpLayer, UITransform).setContentSize(this.screenWidth, this.screenHeight);

        this.hpNodes.length = 0;
        for (let i = 0; i < this.maxLives; i++) {
            const name = `Hp_${i}`;
            const oldHp = this.node.getChildByName(name);
            if (oldHp && oldHp.parent !== this.hpLayer) {
                oldHp.setParent(this.hpLayer);
            }

            const hp = this.createSpriteNode(name, this.hpFrame, this.hpLayer, 222, 198);
            hp.active = true;
            hp.setScale(this.hpIconScale, this.hpIconScale, 1);
            hp.setPosition(-260 + i * 70, 560, 0);
            hp.layer = hpParent.layer;
            const sprite = hp.getComponent(Sprite);
            if (sprite) {
                sprite.color = Color.WHITE;
                if (this.hpFrame) {
                    sprite.spriteFrame = this.hpFrame;
                }
            }
            this.hpNodes.push(hp);
        }

        this.hpTextLabel = this.createLabel('HpTextLabel', `HP: ${this.lives}`, 32, new Vec3(-245, 500, 0), this.hpLayer);
        this.hpTextLabel.color = new Color(255, 70, 70, 255);
        this.hpTextLabel.node.layer = hpParent.layer;
        this.bringHpHudToFront();
    }

    private createLabel(name: string, text: string, size: number, position: Vec3, parent: Node = this.node): Label {
        const node = getOrCreateChild(parent, name);
        node.layer = parent.layer;
        node.setPosition(position);
        getOrAddComponent(node, UITransform).setContentSize(520, size + 20);
        const label = getOrAddComponent(node, Label);
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 8;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }

    private resetGame(): void {
        this.state = 'ready';
        this.score = 0;
        this.lives = this.maxLives;
        this.birdVelocity = 0;
        this.pipeTimer = 0;
        this.coinAnimTimer = 0;
        this.invincibleTimer = 0;

        if (this.bird) {
            this.bird.setPosition(-180, 120, 0);
            this.bird.angle = 0;
            this.setBirdAlpha(255);
        }

        for (const pipe of this.pipes) {
            pipe.root.destroy();
        }
        this.pipes.length = 0;

        this.updateScoreLabels();
        this.updateHpHud();
        if (this.tipLabel) {
            this.tipLabel.node.active = false;
        }
    }

    private startGame(): void {
        this.state = 'playing';
        this.birdVelocity = this.jumpVelocity;
        this.updateHpHud();
        setNodesByNameActive(this.node, 'TipLabel', false);
        if (this.tipLabel) {
            this.tipLabel.node.active = false;
        }
        this.spawnPipe();
    }

    private onTouchStart(): void {
        if (this.state === 'ready') {
            this.startGame();
            return;
        }

        if (this.state === 'gameOver') {
            this.resetGame();
            this.startGame();
            return;
        }

        this.birdVelocity = this.jumpVelocity;
    }

    private updateBirdPhysics(deltaTime: number): void {
        if (!this.bird) {
            return;
        }

        this.birdVelocity += this.gravity * deltaTime;
        const y = this.bird.position.y + this.birdVelocity * deltaTime;
        const clampedY = Math.min(y, this.screenHeight / 2 - this.birdHeight / 2 - 24);
        this.bird.setPosition(this.bird.position.x, clampedY, 0);
        this.bird.angle = Math.max(-55, Math.min(28, this.birdVelocity * 0.055));
    }

    private updateBirdAnimation(deltaTime: number): void {
        if (!this.bird || this.birdFrames.length === 0) {
            return;
        }

        this.birdAnimTimer += deltaTime;
        if (this.birdAnimTimer < 0.12) {
            return;
        }

        this.birdAnimTimer = 0;
        this.birdFrameIndex = (this.birdFrameIndex + 1) % this.birdFrames.length;
        const sprite = this.bird.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = this.birdFrames[this.birdFrameIndex];
        }
    }

    private updateInvincibility(deltaTime: number): void {
        if (this.invincibleTimer <= 0) {
            this.setBirdAlpha(255);
            return;
        }

        this.invincibleTimer = Math.max(0, this.invincibleTimer - deltaTime);
        if (this.invincibleTimer <= 0) {
            this.setBirdAlpha(255);
            return;
        }

        const progress = 1 - this.invincibleTimer / this.invincibleDuration;
        const pulse = Math.abs(Math.sin(progress * Math.PI * 6));
        this.setBirdAlpha(90 + Math.round(pulse * 165));
    }

    private setBirdAlpha(alpha: number): void {
        if (!this.bird) {
            return;
        }

        const sprite = this.bird.getComponent(Sprite);
        if (sprite) {
            sprite.color = new Color(255, 255, 255, alpha);
        }
    }

    private loadHitSound(): void {
        resources.load('audio/hit', AudioClip, (error, clip) => {
            if (error) {
                console.warn('Failed to load hit sound:', error);
                return;
            }

            this.hitClip = clip;
        });
    }

    private playHitSound(): void {
        if (!this.audioSource || !this.hitClip || this.hitSoundTimer > 0) {
            return;
        }

        this.hitSoundTimer = this.hitSoundCooldown;
        this.audioSource.playOneShot(this.hitClip, this.hitSoundVolume);
    }

    private updateLand(deltaTime: number): void {
        for (const land of this.lands) {
            land.setPosition(land.position.x - this.pipeSpeed * deltaTime, land.position.y, 0);
            if (land.position.x <= -this.landWidth) {
                land.setPosition(land.position.x + this.landWidth * this.lands.length, land.position.y, 0);
            }
        }
    }

    private updatePipes(deltaTime: number): void {
        this.pipeTimer += deltaTime;
        if (this.pipeTimer >= this.pipeInterval) {
            this.pipeTimer = 0;
            this.spawnPipe();
        }

        this.updateCoinAnimation(deltaTime);

        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pair = this.pipes[i];
            pair.root.setPosition(pair.root.position.x - this.pipeSpeed * deltaTime, 0, 0);

            if (pair.topBreaking) {
                pair.top.setPosition(pair.top.position.x, pair.top.position.y + this.pipeBreakSpeed * deltaTime, 0);
                if (pair.top.worldPosition.y > this.node.worldPosition.y + this.screenHeight / 2 + this.pipeHeight) {
                    pair.top.active = false;
                    pair.topGone = true;
                    pair.topBreaking = false;
                }
            }

            if (pair.bottomBreaking) {
                pair.bottom.setPosition(pair.bottom.position.x, pair.bottom.position.y - this.pipeBreakSpeed * deltaTime, 0);
                if (pair.bottom.worldPosition.y < this.node.worldPosition.y - this.screenHeight / 2 - this.pipeHeight) {
                    pair.bottom.active = false;
                    pair.bottomGone = true;
                    pair.bottomBreaking = false;
                }
            }

            if (!pair.topGone && !pair.bottomGone && !pair.scored && this.bird && pair.root.position.x + this.pipeWidth / 2 < this.bird.position.x) {
                pair.scored = true;
                this.score += 1;
                this.updateScoreLabels();
            }

            if (pair.root.position.x < -this.screenWidth / 2 - this.pipeWidth - 40 || (pair.topGone && pair.bottomGone)) {
                pair.root.destroy();
                this.pipes.splice(i, 1);
            }
        }
    }

    private updateCoinAnimation(deltaTime: number): void {
        if (this.coinFrames.length === 0 || this.coinAnimDuration <= 0) {
            return;
        }

        this.coinAnimTimer = (this.coinAnimTimer + deltaTime) % this.coinAnimDuration;
        const frameIndex = Math.floor((this.coinAnimTimer / this.coinAnimDuration) * this.coinFrames.length) % this.coinFrames.length;
        const frame = this.coinFrames[frameIndex];
        if (!frame) {
            return;
        }

        for (const pair of this.pipes) {
            for (const coin of pair.coins) {
                if (!coin.active) {
                    continue;
                }

                const sprite = coin.getComponent(Sprite);
                if (sprite) {
                    sprite.spriteFrame = frame;
                }
            }
        }
    }

    private spawnPipe(): void {
        if (!this.pipeLayer) {
            return;
        }

        this.pipeWidth = 52 * this.pipeScale;
        this.pipeHeight = 320 * this.pipeScale;

        const gapRangeByBird = this.getCurrentGapRange();
        const gapHeight = this.birdHeight * (gapRangeByBird.min + Math.random() * (gapRangeByBird.max - gapRangeByBird.min));
        const minGapCenter = this.floorY + gapHeight / 2 + 80;
        const maxGapCenter = this.screenHeight / 2 - gapHeight / 2 - 140;
        const gapRange = Math.max(0, maxGapCenter - minGapCenter);
        const gapCenterY = minGapCenter + Math.random() * gapRange;

        const root = new Node('PipePair');
        root.setParent(this.pipeLayer);
        root.setPosition(this.screenWidth / 2 + this.pipeWidth + 40, 0, 0);

        const top = this.createSpriteNode('PipeDown', this.pipeDownFrame, root, 52, 320);
        top.setScale(this.pipeScale, this.pipeScale, 1);
        top.setPosition(0, gapCenterY + gapHeight / 2 + this.pipeHeight / 2, 0);

        const bottom = this.createSpriteNode('PipeUp', this.pipeUpFrame, root, 52, 320);
        bottom.setScale(this.pipeScale, this.pipeScale, 1);
        bottom.setPosition(0, gapCenterY - gapHeight / 2 - this.pipeHeight / 2, 0);

        const coins = this.createCoins(root, gapCenterY, gapHeight);

        this.pipes.push({
            root,
            top,
            bottom,
            coins,
            scored: false,
            topBreaking: false,
            bottomBreaking: false,
            topGone: false,
            bottomGone: false,
        });
    }

    private getCurrentGapRange(): { min: number; max: number } {
        const difficultyStep = Math.min(3, Math.floor(this.score / 10));
        return {
            min: 1.8 - difficultyStep * 0.1,
            max: 3 - difficultyStep * 0.2,
        };
    }

    private createCoins(parent: Node, gapCenterY: number, gapHeight: number): Node[] {
        const initialFrame = this.coinFrames[0] || this.coinFrame;
        if (!initialFrame || this.coinSize <= 0) {
            return [];
        }

        const coinSpacing = this.coinSize * this.coinGapRatio;
        const coinStep = this.coinSize + coinSpacing;
        const coinCount = Math.max(0, Math.floor((gapHeight + coinSpacing) / coinStep));
        const totalHeight = coinCount * this.coinSize + Math.max(0, coinCount - 1) * coinSpacing;
        const firstY = gapCenterY + totalHeight / 2 - this.coinSize / 2;
        const coinScale = this.coinSize / this.coinFrameHeight;
        const coins: Node[] = [];

        for (let i = 0; i < coinCount; i++) {
            const coin = this.createSpriteNode(`Coin_${i}`, initialFrame, parent, this.coinFrameWidth, this.coinFrameHeight);
            coin.setScale(coinScale, coinScale, 1);
            coin.setPosition(0, firstY - i * coinStep, 0);
            coins.push(coin);
        }

        return coins;
    }

    private checkCollisions(): void {
        if (!this.bird || this.state !== 'playing') {
            return;
        }

        const birdRect = getNodeRect(this.bird, 0.72);
        this.collectTouchedCoins(birdRect);

        if (this.invincibleTimer > 0) {
            const floorWorldY = this.node.worldPosition.y + this.floorY;
            if (birdRect.bottom <= floorWorldY) {
                this.playHitSound();
                this.bird.setPosition(this.bird.position.x, this.floorY + this.birdHeight * 0.36 + 2, 0);
                this.birdVelocity = Math.max(this.birdVelocity, this.groundBounceVelocity);
            }
            if (this.breakTouchedPipe(birdRect)) {
                this.playHitSound();
            }
            return;
        }

        if (birdRect.bottom <= this.node.worldPosition.y + this.floorY) {
            this.playHitSound();
            this.takeDamage();
            this.birdVelocity = this.groundBounceVelocity;
            this.bird.setPosition(this.bird.position.x, this.floorY + this.birdHeight * 0.36 + 2, 0);
            return;
        }

        if (this.breakTouchedPipe(birdRect)) {
            this.playHitSound();
            this.takeDamage();
        }
    }

    private breakTouchedPipe(birdRect: Rect): boolean {
        for (const pipe of this.pipes) {
            const hitTop = !pipe.topBreaking && !pipe.topGone && rectsIntersect(birdRect, getNodeRect(pipe.top, 0.9));
            const hitBottom = !pipe.bottomBreaking && !pipe.bottomGone && rectsIntersect(birdRect, getNodeRect(pipe.bottom, 0.9));
            if (!hitTop && !hitBottom) {
                continue;
            }

            if (hitTop) {
                pipe.topBreaking = true;
            }
            if (hitBottom) {
                pipe.bottomBreaking = true;
            }
            pipe.scored = true;
            return true;
        }

        return false;
    }

    private collectTouchedCoins(birdRect: Rect): void {
        let collected = 0;
        for (const pipe of this.pipes) {
            for (const coin of pipe.coins) {
                if (!coin.active || !rectsIntersect(birdRect, getNodeRect(coin, 0.82))) {
                    continue;
                }

                coin.active = false;
                collected += 1;
            }
        }

        if (collected <= 0) {
            return;
        }

        this.coinScore += collected;
        sys.localStorage.setItem(this.coinScoreKey, String(this.coinScore));
        this.updateScoreLabels();
    }

    private takeDamage(): void {
        if (this.state !== 'playing' || this.invincibleTimer > 0) {
            return;
        }

        this.lives = Math.max(0, this.lives - 1);
        this.updateHpHud();

        if (this.lives <= 0) {
            this.endGame();
            return;
        }

        this.invincibleTimer = this.invincibleDuration;
        this.setBirdAlpha(90);
    }

    private endGame(): void {
        this.state = 'gameOver';
        this.invincibleTimer = 0;
        this.setBirdAlpha(255);
        this.bestScore = Math.max(this.bestScore, this.score);
        sys.localStorage.setItem(this.bestScoreKey, String(this.bestScore));
        this.updateScoreLabels();
        if (this.tipLabel) {
            this.tipLabel.string = 'Game Over\n点击重新开始';
            this.tipLabel.node.active = true;
        }
    }

    private updateScoreLabels(): void {
        if (this.scoreLabel) {
            this.scoreLabel.string = `${this.score}`;
        }
        if (this.bestLabel) {
            this.bestLabel.string = `Best ${this.bestScore}`;
        }
        if (this.coinScoreLabel) {
            this.coinScoreLabel.string = `Coin ${this.coinScore}`;
        }
    }

    private updateHpHud(): void {
        this.bringHpHudToFront();
        for (let i = 0; i < this.hpNodes.length; i++) {
            this.hpNodes[i].active = i < this.lives;
        }
        if (this.hpTextLabel) {
            this.hpTextLabel.string = `HP: ${this.lives}`;
            this.hpTextLabel.node.active = true;
        }
        this.layoutHud();
    }

    private refreshScreenSize(): void {
        const visibleSize = view.getVisibleSize();
        const nextWidth = Math.max(1, visibleSize.width);
        const nextHeight = Math.max(1, visibleSize.height);
        const sizeChanged = Math.abs(nextWidth - this.screenWidth) > 0.5 || Math.abs(nextHeight - this.screenHeight) > 0.5;

        this.screenWidth = nextWidth;
        this.screenHeight = nextHeight;

        const canvasTransform = this.node.getComponent(UITransform);
        if (canvasTransform) {
            canvasTransform.setContentSize(this.screenWidth, this.screenHeight);
        }
        if (this.hudLayer) {
            getOrAddComponent(this.hudLayer, UITransform).setContentSize(this.screenWidth, this.screenHeight);
        }
        if (this.hpLayer) {
            getOrAddComponent(this.hpLayer, UITransform).setContentSize(this.screenWidth, this.screenHeight);
        }

        this.floorY = -this.screenHeight / 2 + this.landHeight + this.landOffsetY;

        if (!sizeChanged) {
            return;
        }

        const bg = this.world?.getChildByName('Background');
        if (bg) {
            const scale = Math.max(this.screenWidth / 288, this.screenHeight / 512);
            bg.setScale(scale, scale, 1);
        }

        for (const land of this.lands) {
            land.setPosition(land.position.x, this.floorY - this.landHeight / 2, 0);
        }
    }

    private layoutHud(): void {
        const halfWidth = this.screenWidth / 2;
        const halfHeight = this.screenHeight / 2;
        const topY = halfHeight - 64;

        if (this.hudLayer) {
            this.hudLayer.active = true;
            this.hudLayer.setPosition(0, 0, 0);
            const parent = this.hudLayer.parent;
            if (parent) {
                this.hudLayer.setSiblingIndex(parent.children.length - 1);
            }
        }

        if (this.scoreLabel) {
            this.scoreLabel.node.setPosition(0, topY - 14, 0);
        }
        if (this.bestLabel) {
            this.bestLabel.node.setPosition(0, topY - 74, 0);
        }
        if (this.coinScoreLabel) {
            this.coinScoreLabel.node.setPosition(halfWidth - 112, topY - 16, 0);
        }
        if (this.tipLabel) {
            this.tipLabel.node.setPosition(0, Math.min(120, halfHeight - 220), 0);
        }

        const hpStartX = -halfWidth + 58;
        for (let i = 0; i < this.hpNodes.length; i++) {
            this.hpNodes[i].setPosition(hpStartX + i * 70, topY, 0);
        }
        if (this.hpTextLabel) {
            this.hpTextLabel.node.setPosition(-halfWidth + 112, topY - 62, 0);
        }
    }

    private bringHpHudToFront(): void {
        if (!this.hpLayer) {
            return;
        }

        this.hpLayer.active = true;
        const parent = this.hpLayer.parent;
        if (parent) {
            this.hpLayer.setSiblingIndex(parent.children.length - 1);
        }
    }

    private createSpriteNode(name: string, frame: SpriteFrame | null, parent: Node | null, width: number, height: number): Node {
        const node = parent ? getOrCreateChild(parent, name) : new Node(name);
        getOrAddComponent(node, UITransform).setContentSize(width, height);
        const sprite = getOrAddComponent(node, Sprite);
        if (frame) {
            sprite.spriteFrame = frame;
        }
        return node;
    }

    private removeOldCanvasHudNodes(): void {
        if (!this.world) {
            return;
        }

        for (const name of ['ScoreLabel', 'BestLabel', 'CoinScoreLabel', 'TipLabel', 'HpLayer']) {
            const oldNode = this.node.getChildByName(name);
            if (oldNode) {
                oldNode.destroy();
            }
        }
    }
}

interface Rect {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

function getNodeRect(node: Node, shrink = 1): Rect {
    const transform = node.getComponent(UITransform);
    const width = (transform?.width || 0) * Math.abs(node.worldScale.x) * shrink;
    const height = (transform?.height || 0) * Math.abs(node.worldScale.y) * shrink;
    const center = node.worldPosition;

    return {
        left: center.x - width / 2,
        right: center.x + width / 2,
        top: center.y + height / 2,
        bottom: center.y - height / 2,
    };
}

function rectsIntersect(a: Rect, b: Rect): boolean {
    return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
}

function getOrCreateChild(parent: Node, name: string): Node {
    const existing = parent.getChildByName(name);
    if (existing) {
        return existing;
    }

    const child = new Node(name);
    child.setParent(parent);
    return child;
}

function setNodesByNameActive(root: Node, name: string, active: boolean): void {
    if (root.name === name) {
        root.active = active;
    }

    for (const child of root.children) {
        setNodesByNameActive(child, name, active);
    }
}

function getOrAddComponent<T extends Component>(node: Node, type: new () => T): T {
    return node.getComponent(type) || node.addComponent(type);
}
