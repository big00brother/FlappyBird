import {
    _decorator,
    AudioClip,
    AudioSource,
    Color,
    Component,
    director,
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
import { AudioManager, AudioSettings } from './AudioManager';

const { ccclass, property } = _decorator;
const BACKGROUND_WIDTH = 640;
const BACKGROUND_HEIGHT = 1480;

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
    isMoving: boolean;
    moveBaseY: number;
    moveTimer: number;
    moveAmplitude: number;
    moveSpeed: number;
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
    public pipeBodyFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public pipeCapFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public hpFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public coinFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public gameOverPanelFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonNormalFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonPressedFrame: SpriteFrame | null = null;

    @property([SpriteFrame])
    public coinFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public birdFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public redBirdFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public blueBirdFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public purpleBirdFrames: SpriteFrame[] = [];

    private readonly bestScoreKey = 'flappy_best_score';
    private readonly coinScoreKey = 'flappy_coin_score';
    private readonly ownedBirdsKey = 'flappy_owned_birds';
    private readonly selectedBirdKey = 'flappy_selected_bird';

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
    private gameOverPanel: Node | null = null;
    private restartButton: Node | null = null;
    private menuButton: Node | null = null;
    private reviveButton: Node | null = null;
    private audioSource: AudioSource | null = null;
    private hitClip: AudioClip | null = null;
    private jumpClip: AudioClip | null = null;
    private coinClip: AudioClip | null = null;
    private lands: Node[] = [];
    private hpNodes: Node[] = [];
    private pipes: PipePair[] = [];
    private activeBirdFrames: SpriteFrame[] = [];

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
    private reviveAvailable = true;
    private pressedGameOverButton: Node | null = null;

    private birdScale = 1.8;
    private landScale = 2;
    private pipeScale = 2;
    private landHeight = 224;
    private landVisualHeight = 544;
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
    private landOffsetY = 100;
    private maxLives = 3;
    private invincibleDuration = 1;
    private pipeBreakSpeed = 820;
    private movingPipeAmplitude = 70;
    private movingPipeMinAmplitude = 20;
    private movingPipeSpeed = 1.4;
    private movingPipeTopMargin = 8;
    private groundBounceVelocity = 860;
    private hpIconScale = 0.32;
    private hitSoundCooldown = 0.08;
    private hitSoundVolume = 0.85;
    private jumpSoundVolume = 0.55;
    private coinSoundVolume = 0.65;
    private coinAnimDuration = 0.5;

    protected onLoad(): void {
        this.refreshScreenSize();
        AudioManager.ensure();
        this.audioSource = getOrAddComponent(this.node, AudioSource);
        this.loadEffectSounds();
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
        const bg = this.createSpriteNode('Background', this.bgFrame, this.world, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
        const scale = Math.max(this.screenWidth / BACKGROUND_WIDTH, this.screenHeight / BACKGROUND_HEIGHT);
        bg.setScale(scale, scale, 1);
    }

    private createLand(): void {
        this.landHeight = 112 * this.landScale;
        this.landVisualHeight = 272 * this.landScale;
        this.landWidth = 336 * this.landScale;
        this.floorY = -this.screenHeight / 2 + this.landHeight + this.landOffsetY;

        for (let i = 0; i < 2; i++) {
            const x = i * this.landWidth;
            const land = this.createSpriteNode(`Land_${i}`, this.landFrame, this.world, 336, 272);
            land.setScale(this.landScale, this.landScale, 1);
            land.setPosition(x, this.floorY - this.landVisualHeight / 2);
            this.lands.push(land);
        }
    }

    private createBird(): void {
        this.activeBirdFrames = this.getSelectedBirdFrames();
        this.bird = this.createSpriteNode('Bird', this.activeBirdFrames[0] || this.birdFrames[0] || null, this.world, 48, 48);
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
        this.createGameOverPanel();
        if (this.tipLabel) {
            this.tipLabel.node.active = false;
        }
        this.layoutHud();
    }

    private createGameOverPanel(): void {
        const parent = this.hudLayer || this.world || this.node;
        this.gameOverPanel = this.createSpriteNode('GameOverPanel', this.gameOverPanelFrame, parent, 480, 380);
        this.gameOverPanel.active = false;
        this.gameOverPanel.layer = parent.layer;

        const title = this.createLabel('GameOverTitle', '游戏结束', 42, new Vec3(0, 0, 0), this.gameOverPanel);
        title.color = Color.WHITE;

        this.restartButton = this.createGameOverButton('RestartButton', '重新开始', () => this.restartGame());
        this.menuButton = this.createGameOverButton('MenuButton', '回到主菜单', () => this.backToMainMenu());
        this.reviveButton = this.createGameOverButton('ReviveButton', '立即复活', () => this.reviveGame());
    }

    private createGameOverButton(name: string, text: string, onClick: () => void): Node {
        const parent = this.gameOverPanel || this.hudLayer || this.world || this.node;
        const button = this.createSpriteNode(name, this.buttonNormalFrame, parent, 260, 72);
        button.layer = parent.layer;

        const label = this.createLabel(`${name}Label`, text, 30, new Vec3(0, 2, 0), button);
        label.color = new Color(90, 46, 0, 255);

        this.bindGameOverButton(button, onClick);
        return button;
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
        this.reviveAvailable = true;

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
        this.hideGameOverPanel();
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
            this.playJumpSound();
            return;
        }

        if (this.state === 'gameOver') {
            return;
        }

        this.birdVelocity = this.jumpVelocity;
        this.playJumpSound();
    }

    private bindGameOverButton(button: Node, onClick: () => void): void {
        button.on(Node.EventType.TOUCH_START, () => {
            this.pressedGameOverButton = button;
            this.setSpriteFrame(button, this.buttonPressedFrame || this.buttonNormalFrame);
        }, this);
        button.on(Node.EventType.TOUCH_CANCEL, () => {
            if (this.pressedGameOverButton === button) {
                this.pressedGameOverButton = null;
            }
            this.setSpriteFrame(button, this.buttonNormalFrame);
        }, this);
        button.on(Node.EventType.TOUCH_END, () => {
            const shouldClick = this.pressedGameOverButton === button;
            this.pressedGameOverButton = null;
            this.setSpriteFrame(button, this.buttonNormalFrame);
            if (shouldClick) {
                onClick();
            }
        }, this);
    }

    private restartGame(): void {
        this.resetGame();
        this.startGame();
    }

    private backToMainMenu(): void {
        director.loadScene('Start');
    }

    private reviveGame(): void {
        if (!this.reviveAvailable || this.state !== 'gameOver') {
            return;
        }

        this.reviveAvailable = false;
        this.state = 'playing';
        this.lives = this.maxLives;
        this.invincibleTimer = this.invincibleDuration;
        this.birdVelocity = this.jumpVelocity;
        if (this.bird) {
            const safeY = Math.max(this.bird.position.y, this.floorY + this.birdHeight * 1.25);
            this.bird.setPosition(this.bird.position.x, safeY, 0);
            this.bird.angle = 0;
        }
        this.setBirdAlpha(90);
        this.updateHpHud();
        this.hideGameOverPanel();
        if (this.tipLabel) {
            this.tipLabel.node.active = false;
        }
    }

    private showGameOverPanel(): void {
        if (!this.gameOverPanel) {
            return;
        }

        this.gameOverPanel.active = true;
        if (this.reviveButton) {
            this.reviveButton.active = this.reviveAvailable;
        }
        if (this.tipLabel) {
            this.tipLabel.node.active = false;
        }
        const parent = this.gameOverPanel.parent;
        if (parent) {
            this.gameOverPanel.setSiblingIndex(parent.children.length - 1);
        }
        this.layoutHud();
    }

    private hideGameOverPanel(): void {
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }
        this.pressedGameOverButton = null;
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
        const frames = this.activeBirdFrames.length > 0 ? this.activeBirdFrames : this.birdFrames;
        if (!this.bird || frames.length === 0) {
            return;
        }

        this.birdAnimTimer += deltaTime;
        if (this.birdAnimTimer < 0.12) {
            return;
        }

        this.birdAnimTimer = 0;
        this.birdFrameIndex = (this.birdFrameIndex + 1) % frames.length;
        const sprite = this.bird.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = frames[this.birdFrameIndex];
        }
    }

    private getSelectedBirdFrames(): SpriteFrame[] {
        const selectedBird = sys.localStorage.getItem(this.selectedBirdKey) || 'default';
        const ownedBirds = this.getOwnedBirdIds();
        if (ownedBirds.indexOf(selectedBird) < 0) {
            return this.birdFrames;
        }

        if (selectedBird === 'red' && this.redBirdFrames.length > 0) {
            return this.redBirdFrames;
        }
        if (selectedBird === 'blue' && this.blueBirdFrames.length > 0) {
            return this.blueBirdFrames;
        }
        if (selectedBird === 'purple' && this.purpleBirdFrames.length > 0) {
            return this.purpleBirdFrames;
        }

        return this.birdFrames;
    }

    private getOwnedBirdIds(): string[] {
        const rawOwnedBirds = sys.localStorage.getItem(this.ownedBirdsKey);
        if (!rawOwnedBirds) {
            return ['default'];
        }

        try {
            const parsed = JSON.parse(rawOwnedBirds);
            if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
                return parsed.indexOf('default') >= 0 ? parsed : ['default', ...parsed];
            }
        } catch {
            return ['default'];
        }

        return ['default'];
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

    private loadEffectSounds(): void {
        this.loadAudioClip('audio/hit', (clip) => {
            this.hitClip = clip;
        });
        this.loadAudioClip('audio/jump', (clip) => {
            this.jumpClip = clip;
        });
        this.loadAudioClip('audio/coin', (clip) => {
            this.coinClip = clip;
        });
    }

    private loadAudioClip(path: string, onLoaded: (clip: AudioClip) => void): void {
        resources.load(path, AudioClip, (error, clip) => {
            if (error) {
                console.warn(`Failed to load audio clip: ${path}`, error);
                return;
            }

            onLoaded(clip);
        });
    }

    private playHitSound(): void {
        if (!AudioSettings.isSoundEnabled() || !this.audioSource || !this.hitClip || this.hitSoundTimer > 0) {
            return;
        }

        this.hitSoundTimer = this.hitSoundCooldown;
        this.audioSource.playOneShot(this.hitClip, this.hitSoundVolume);
    }

    private playJumpSound(): void {
        this.playEffectSound(this.jumpClip, this.jumpSoundVolume);
    }

    private playCoinSound(): void {
        this.playEffectSound(this.coinClip, this.coinSoundVolume);
    }

    private playEffectSound(clip: AudioClip | null, volume: number): void {
        if (!AudioSettings.isSoundEnabled() || !this.audioSource || !clip) {
            return;
        }

        this.audioSource.playOneShot(clip, volume);
    }

    private updateLand(deltaTime: number): void {
        for (let i = 0; i < this.lands.length; i++) {
            const land = this.lands[i];
            let nextX = land.position.x - this.pipeSpeed * deltaTime;
            if (nextX <= -this.landWidth) {
                nextX += this.landWidth * this.lands.length;
            }

            land.setPosition(nextX, land.position.y, 0);
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
            let nextRootY = pair.moveBaseY;
            if (pair.isMoving) {
                pair.moveTimer += deltaTime;
                nextRootY = pair.moveBaseY + Math.sin(pair.moveTimer * pair.moveSpeed) * pair.moveAmplitude;
            }
            pair.root.setPosition(pair.root.position.x - this.pipeSpeed * deltaTime, nextRootY, 0);

            if (pair.topBreaking) {
                pair.top.setPosition(pair.top.position.x, pair.top.position.y + this.pipeBreakSpeed * deltaTime, 0);
                if (getNodeRect(pair.top).bottom > this.node.worldPosition.y + this.screenHeight / 2 + 120) {
                    pair.top.active = false;
                    pair.topGone = true;
                    pair.topBreaking = false;
                }
            }

            if (pair.bottomBreaking) {
                pair.bottom.setPosition(pair.bottom.position.x, pair.bottom.position.y - this.pipeBreakSpeed * deltaTime, 0);
                if (getNodeRect(pair.bottom).top < this.node.worldPosition.y - this.screenHeight / 2 - 120) {
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
        const minGapCenter = this.floorY + gapHeight / 2 + 160;
        const maxGapCenter = this.screenHeight / 2 - gapHeight / 2 - 140;
        const gapRange = Math.max(0, maxGapCenter - minGapCenter);
        const gapCenterY = minGapCenter + Math.random() * gapRange;

        const root = new Node('PipePair');
        root.setParent(this.pipeLayer);
        root.setPosition(this.screenWidth / 2 + this.pipeWidth + 40, 0, 0);

        const gapTopY = gapCenterY + gapHeight / 2;
        const gapBottomY = gapCenterY - gapHeight / 2;
        const screenTopY = this.screenHeight / 2 + 120;
        const screenBottomY = -this.screenHeight / 2 - 120;

        const top = this.createPipeObstacle('PipeDown', this.pipeDownFrame, root, gapTopY, screenTopY, 1);
        const bottom = this.createPipeObstacle('PipeUp', this.pipeUpFrame, root, gapBottomY, screenBottomY, -1);

        const coins = this.createCoins(root, gapCenterY, gapHeight);
        const motion = this.createPipeMotion(gapCenterY, gapHeight);

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
            isMoving: motion.isMoving,
            moveBaseY: 0,
            moveTimer: motion.phase,
            moveAmplitude: motion.amplitude,
            moveSpeed: motion.speed,
        });
    }

    private createPipeMotion(gapCenterY: number, gapHeight: number): { isMoving: boolean; amplitude: number; speed: number; phase: number } {
        const chance = this.getMovingPipeChance();
        if (chance <= 0 || Math.random() >= chance) {
            return { isMoving: false, amplitude: 0, speed: this.movingPipeSpeed, phase: 0 };
        }

        const gapTopY = gapCenterY + gapHeight / 2;
        const gapBottomY = gapCenterY - gapHeight / 2;
        const pipeHeadVisibleHeight = this.getPipeHeadVisibleHeight();
        const upwardSpace = this.screenHeight / 2 - this.movingPipeTopMargin - (gapTopY + pipeHeadVisibleHeight);
        const downwardSpace = gapBottomY - pipeHeadVisibleHeight - this.floorY;
        const amplitude = Math.min(this.movingPipeAmplitude, upwardSpace, downwardSpace);
        if (amplitude < this.movingPipeMinAmplitude) {
            return { isMoving: false, amplitude: 0, speed: this.movingPipeSpeed, phase: 0 };
        }

        return {
            isMoving: true,
            amplitude,
            speed: this.movingPipeSpeed,
            phase: Math.random() * Math.PI * 2,
        };
    }

    private getPipeHeadVisibleHeight(): number {
        return this.pipeCapFrame ? 44 * this.pipeScale : 86;
    }

    private getMovingPipeChance(): number {
        if (this.score < 20) {
            return 0;
        }
        if (this.score < 40) {
            return 1 / 5;
        }
        if (this.score < 50) {
            return 1 / 4;
        }
        return 1 / 3;
    }

    private createPipeObstacle(name: string, capFrame: SpriteFrame | null, parent: Node, gapEdgeY: number, endY: number, direction: 1 | -1): Node {
        const height = Math.max(this.pipeHeight, Math.abs(endY - gapEdgeY));
        const centerY = gapEdgeY + direction * height / 2;
        const obstacle = new Node(name);
        obstacle.setParent(parent);
        obstacle.setPosition(0, centerY, 0);
        getOrAddComponent(obstacle, UITransform).setContentSize(this.pipeWidth, height);

        if (!this.pipeCapFrame) {
            const cap = this.createSpriteNode(`${name}Cap`, capFrame, obstacle, 52, 320);
            cap.setScale(this.pipeScale, this.pipeScale, 1);
            cap.setPosition(0, direction > 0 ? -height / 2 + this.pipeHeight / 2 : height / 2 - this.pipeHeight / 2, 0);

            if (!this.pipeBodyFrame) {
                return obstacle;
            }

            const bodyHeight = 64 * this.pipeScale;
            const capVisibleHeight = 86;
            let bodyY = direction > 0
                ? -height / 2 + capVisibleHeight + bodyHeight / 2
                : height / 2 - capVisibleHeight - bodyHeight / 2;
            const limitY = direction > 0 ? height / 2 + bodyHeight / 2 : -height / 2 - bodyHeight / 2;
            let bodyIndex = 0;

            while (direction > 0 ? bodyY < limitY : bodyY > limitY) {
                const body = this.createSpriteNode(`${name}Body_${bodyIndex}`, this.pipeBodyFrame, obstacle, 52, 64);
                body.setScale(this.pipeScale, this.pipeScale, 1);
                body.setPosition(0, bodyY, 0);
                bodyY += direction * bodyHeight;
                bodyIndex += 1;
            }

            return obstacle;
        }

        if (!this.pipeBodyFrame) {
            const cap = this.createSpriteNode(`${name}Cap`, this.pipeCapFrame, obstacle, 64, 88);
            cap.setScale(this.pipeScale, direction > 0 ? -this.pipeScale : this.pipeScale, 1);
            const capHeight = 88 * this.pipeScale;
            cap.setPosition(0, direction > 0 ? -height / 2 + capHeight / 2 : height / 2 - capHeight / 2, 0);
            return obstacle;
        }

        const bodyHeight = 64 * this.pipeScale;
        const capVisibleHeight = 44 * this.pipeScale;
        const capJoinOverlap = 10;
        let bodyY = direction > 0
            ? -height / 2 + capVisibleHeight - capJoinOverlap + bodyHeight / 2
            : height / 2 - capVisibleHeight + capJoinOverlap - bodyHeight / 2;
        const limitY = direction > 0 ? height / 2 + bodyHeight / 2 : -height / 2 - bodyHeight / 2;
        let bodyIndex = 0;

        while (direction > 0 ? bodyY < limitY : bodyY > limitY) {
            const body = this.createSpriteNode(`${name}Body_${bodyIndex}`, this.pipeBodyFrame, obstacle, 52, 64);
            body.setScale(this.pipeScale, this.pipeScale, 1);
            body.setPosition(0, bodyY, 0);
            bodyY += direction * bodyHeight;
            bodyIndex += 1;
        }

        const cap = this.createSpriteNode(`${name}Cap`, this.pipeCapFrame, obstacle, 64, 88);
        cap.setScale(this.pipeScale, direction > 0 ? -this.pipeScale : this.pipeScale, 1);
        const capHeight = 88 * this.pipeScale;
        cap.setPosition(0, direction > 0 ? -height / 2 + capHeight / 2 : height / 2 - capHeight / 2, 0);

        return obstacle;
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
        this.playCoinSound();
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
        this.showGameOverPanel();
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
            const scale = Math.max(this.screenWidth / BACKGROUND_WIDTH, this.screenHeight / BACKGROUND_HEIGHT);
            bg.setScale(scale, scale, 1);
        }

        for (const land of this.lands) {
            land.setPosition(land.position.x, this.floorY - this.landVisualHeight / 2, 0);
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
        this.layoutGameOverPanel();

        const hpStartX = -halfWidth + 58;
        for (let i = 0; i < this.hpNodes.length; i++) {
            this.hpNodes[i].setPosition(hpStartX + i * 70, topY, 0);
        }
        if (this.hpTextLabel) {
            this.hpTextLabel.node.setPosition(-halfWidth + 112, topY - 62, 0);
        }
    }

    private layoutGameOverPanel(): void {
        if (!this.gameOverPanel) {
            return;
        }

        const panelWidth = Math.min(500, Math.max(360, this.screenWidth * 0.78));
        const panelHeight = panelWidth * 0.79;
        getOrAddComponent(this.gameOverPanel, UITransform).setContentSize(panelWidth, panelHeight);
        this.gameOverPanel.setPosition(0, Math.min(60, this.screenHeight * 0.04), 0);

        const title = this.gameOverPanel.getChildByName('GameOverTitle');
        if (title) {
            getOrAddComponent(title, UITransform).setContentSize(panelWidth * 0.9, 62);
            title.setPosition(0, panelHeight * 0.31, 0);
        }

        const buttons = [this.restartButton, this.menuButton, this.reviveButton].filter((button): button is Node => !!button && button.active);
        const buttonWidth = panelWidth * 0.56;
        const buttonHeight = 66;
        const spacing = buttonHeight + 16;
        const firstY = buttons.length === 3 ? panelHeight * 0.12 : panelHeight * 0.02;
        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            getOrAddComponent(button, UITransform).setContentSize(buttonWidth, buttonHeight);
            button.setPosition(0, firstY - i * spacing, 0);

            const label = button.getChildByName(`${button.name}Label`);
            if (label) {
                getOrAddComponent(label, UITransform).setContentSize(buttonWidth, buttonHeight);
                label.setPosition(0, 2, 0);
            }
        }

        if (this.gameOverPanel.active) {
            const parent = this.gameOverPanel.parent;
            if (parent) {
                this.gameOverPanel.setSiblingIndex(parent.children.length - 1);
            }
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

    private setSpriteFrame(node: Node | null, frame: SpriteFrame | null): void {
        if (!node || !frame) {
            return;
        }

        const sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = frame;
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
