import * as settings from './settings.js'

export class MotionTrackerDevice
{
	static PIXILoader = null;

	constructor(element_container, config)
	{
		//private variables
		this.container = element_container;
		this.dimensions = config.dimensions;
		this.config = config;
		this.tokenReference = null;

		this.user = null;

		this.signals = [];
		this.signalsMax = 20;
		
		const distanceMax = game.settings.get(settings.REGISTER_CODE,'maxDistance');
		this.distUnitPerPx = 0.8*settings.MAX_SIZE*.5/distanceMax;

		this.soundBank = {};
		// Renderer specific
		this.pixi = {
			app: null,
			sprite_background: null,
			sprites_signals: [],
			center: {x:0, y: 0}
		};

		this.ready = false;

		// data
		this.textures = {
			background: 'modules/motion_tracker/textures/motion_tracker_background.webp',
			ping: 'modules/motion_tracker/textures/motion_tracker_ping.webp',
		};
		this.loadTextures();
	}

	preloadSounds()
	{
		let foundsounds = [];// TODO: 'scanning', 'close','medium','far'];
		foundsounds.forEach(v => 
		{
			let path = `modules/motion_tracker/sounds/${v}.wav`;
			AudioHelper.play({
				src: path,
				autoplay: false
			}, false);
			this.soundBank[v] = path;
		});
	}

	loadTextures()
	{
		if(MotionTrackerDevice.PIXILoader === null)
		{
			MotionTrackerDevice.PIXILoader =  new PIXI.Loader();
			// clean cache
			PIXI.Texture.removeFromCache(this.textures.background);
			PIXI.Texture.removeFromCache(this.textures.ping);
			PIXI.BaseTexture.removeFromCache(this.textures.background);
			PIXI.BaseTexture.removeFromCache(this.textures.ping);
			MotionTrackerDevice.PIXILoader
			.add([this.textures.background, this.textures.ping])
			.load(this.loadTexturesFinish.bind(this));
		}
		else
		{
			this.loadTexturesFinish(); // simply apply the end process
		}
	}

	async loadTexturesFinish()
	{
		const SIZE = game.settings.get(settings.REGISTER_CODE, 'size');
		
		const distanceMax = game.settings.get(settings.REGISTER_CODE,'maxDistance');
		this.distUnitPerPx = 0.8*SIZE*.5/distanceMax;

		//Create the `cat` sprite
		if(this.pixi.sprite_background===null)
			this.pixi.sprite_background = new PIXI.Sprite(PIXI.utils.TextureCache[this.textures.background]);
		
		this.pixi.sprite_background.x = 0;
		this.pixi.sprite_background.y = 0;
		this.pixi.sprite_background.width = SIZE;
		this.pixi.sprite_background.height = SIZE;

		if(this.pixi.sprites_signals.length==0)
		{
			for(let i = 0;i<this.signalsMax;++i)
			{
				this.pixi.sprites_signals[i] = new PIXI.Sprite(PIXI.utils.TextureCache[this.textures.ping]);
				this.pixi.sprites_signals[i].x = 0;
				this.pixi.sprites_signals[i].y = 0;
				this.pixi.sprites_signals[i].anchor.set(0.5, 0.5);
				this.pixi.sprites_signals[i].visible = false;
				this.pixi.sprites_signals[i].width = Math.max(32, SIZE/32*this.distUnitPerPx);
				this.pixi.sprites_signals[i].height = Math.max(32, SIZE/32*this.distUnitPerPx);
			}
		}
	      
		//Add the cat to the stage so you can see it

		this.ready = true;

		await this.container!==null;

		// PIXI context creation
		if(this.pixi.app === null)
		{
			this.pixi.app = new PIXI.Application({width: SIZE, height: SIZE});
		}
		
		this.pixi.app.stage.removeChildren();

		this.container.appendChild(this.pixi.app.view);

		// setup base
		this.pixi.app.renderer.backgroundColor = 0x000000;
		
		this.pixi.app.stage.addChild(this.pixi.sprite_background);
		for(let i = 0;i<this.pixi.sprites_signals.length;++i)
		{
			this.pixi.app.stage.addChild(this.pixi.sprites_signals[i]);
		}

		this.pixi.app.ticker.add(delta => this.update(delta));
	}

	async reset()
	{
		return new Promise(resolve => {
				this.loadTexturesFinish();
				resolve();
			}
		);
	}

	resize(size)
	{
		if(this.pixi.app && this.pixi.app.render)
		{
			this.pixi.app.renderer.autoDensity = true;
			this.pixi.app.renderer.resize(size, size);
		}
	}

	playSound(sound)
	{
		let volume = sound[1] * this.volume;
		AudioHelper.play({
			src: sound[0],
			volume: volume
		}, false);
	}

	update(delta)
	{
		if(this.user===null || this.tokenReference===null)
			return;
		// wipe precedent signals
		this.signals.length = 0;

		function computeTokenCenter(token)
		{
			return {
				x:0.5*token.scale*token.width+token.x,
				y:0.5*token.scale*token.height+token.y
			};
		}

		const scene = game.scenes.get(this.viewedSceneId);
		const tokens = scene.data.tokens;
		const seePlayers = game.settings.get(settings.REGISTER_CODE,'seePlayers');
		const distanceMax = game.settings.get(settings.REGISTER_CODE,'maxDistance');
		const immobileStatuses = [CONFIG.Combat.defeatedStatusId, 'unconscious', 'asleep', 'stunned', 'paralysis']
		const pos = computeTokenCenter(this.tokenReference);
		tokens.forEach(token => 
			{
				let immobile = token.actorData?.effects?.find(e => immobileStatuses.some(s=>s===e.flags.core.statusId));
				
				if(!immobile && token._id!==this.tokenReference._id && !token.hidden)
				{
					const oPos = computeTokenCenter(token);
					oPos.x = (oPos.x-pos.x)/scene.data.grid;
					oPos.y = (oPos.y-pos.y)/scene.data.grid;
					const normDir = Math.sqrt(oPos.x*oPos.x+oPos.y*oPos.y);
					let scanResult = { distance: scene.data.gridDistance*normDir, dir: { x: oPos.x/normDir, y: oPos.y/normDir } };
					if(scanResult.distance<distanceMax)
						this.signals.push(scanResult);
				}
			});
		for(let i = 0;i<this.pixi.sprites_signals.length;++i)
		{
			if(i<this.signals.length)
			{
				this.pixi.sprites_signals[i].visible = true;
				this.pixi.sprites_signals[i].x = this.distUnitPerPx*this.signals[i].dir.x*this.signals[i].distance+.5*this.pixi.app.stage.width;
				this.pixi.sprites_signals[i].y = this.distUnitPerPx*this.signals[i].dir.y*this.signals[i].distance+.5*this.pixi.app.stage.width;
			}
			else
				this.pixi.sprites_signals[i].visible = false;
		}
	}

	setData(user = game.user, tokenId, viewedSceneId)
	{
		this.user = user;
		this.tokenReference = null;
		this.viewedSceneId = viewedSceneId;
		const scene = game.scenes.get(this.viewedSceneId);
		const tokens = scene.data.tokens;
		if(tokens.length>0)
			this.tokenReference = tokens.find(tok => tok._id === tokenId);
	}
}