import * as settings from './settings.js'
import {MotionTracker} from './motion_tracker.js'

export class MotionTrackerDevice
{
	static PIXILoader = null;
	// BEGIN SHADER BLOCK
	static signalFunc = '\
	float signal(float x)\
	{\
		x = fract(x);\
		return max(\
			fract(3.*x)*min(1., floor(3.*fract(x))),\
			 floor(.5*(ceil(3.*x)-1.))\
			 );\
	}\
	';
	static commonShaderCode = '\
	float h2(vec2 _uv) \
	{\
		vec2 suv = sin(_uv); \
		return fract(mix(suv.x*13.13032942, suv.y*12.01293203924, dot(_uv, suv))); \
	}\
	float oldScreenGlitch(vec2 _uv, float _s, float _t) \
	{\
		float h = floor(2.*fract(16.*_s*_uv.y)); \
		float g = h2(_s*_uv+_t); \
    	g += .1*h; \
		g = clamp(g, 0., 1.); \
    	g *= g; \
    	g = g*g*(3.-2.*g); \
		return g; \
	}\
	';
	static fragShaderM314Background = '\
		varying vec2 vTextureCoord;\
		uniform sampler2D uSampler;\
		uniform bool applyGlitch;\
		uniform float time;\
		uniform float speed;\
		uniform float centerx;\
		uniform float centery;\
		uniform float ratio;\
		uniform vec4 finalColorMask;\
		'+MotionTrackerDevice.commonShaderCode+'\
		'+MotionTrackerDevice.signalFunc+'\
		void main(void)\
		{\
			vec4 tex = texture2D(uSampler, vTextureCoord);\
			vec2 rc = 2.*(vTextureCoord*vec2(1., 1./ratio)-vec2(.5));\
			vec2 d = normalize(rc);\
			float s = signal(speed*time);\
			s = s>0.05?(tex.a*pow(clamp(1.-length(vTextureCoord*vec2(1., 1./ratio)-(s*d+vec2(.5)))-.75, 0., 1.)*4., 16.)):0.;\
			s *= 1.+log(-fract(speed*time)+1.);\
	   		gl_FragColor = mix(vec4(tex.rgb, 1.), vec4(1.), s);\
			gl_FragColor = finalColorMask*gl_FragColor;\
			if(applyGlitch)\
			{\
				float g = .5*oldScreenGlitch(vTextureCoord, 1024., time);\
				gl_FragColor = (1.-g)*gl_FragColor+g;\
			}\
		}';
	static vertShaderPing = '\
		attribute vec2 aVertexPosition;\
		attribute vec2 aTextureCoord;\
		\
		uniform mat3 projectionMatrix;\
		\
		varying vec2 vTextureCoord;\
		varying vec2 vWorldCoord;\
		\
		void main(void)\
		{\
			vWorldCoord = aVertexPosition;\
			gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);\
			vTextureCoord = aTextureCoord;\
		}';
	static fragShaderPing = '\
		varying vec2 vTextureCoord;\
		varying vec2 vWorldCoord;\
		uniform sampler2D uSampler;\
		uniform float time;\
		uniform float speed;\
		uniform float emissive;\
		uniform float centerx;\
		uniform float centery;\
		uniform float distmax;\
		'+MotionTrackerDevice.signalFunc+'\
		void main(void)\
		{\
			vec2 c = vec2(centerx, centery);\
			vec2 cp = vWorldCoord-c;\
			vec2 d = normalize(cp);\
			float s = 2.*signal(speed*time);\
			s = s*length(c*d)>length(cp)?exp(-1.5*fract(speed*time)):0.;\
			gl_FragColor = emissive*s*texture2D(uSampler, vTextureCoord).rrrr;\
		}';
	static fragShaderAriousBackground = '\
		varying vec2 vTextureCoord;\
		uniform sampler2D uSampler;\
		uniform bool applyGlitch;\
		uniform float time;\
		uniform float speed;\
		uniform float centerx;\
		uniform float centery;\
		uniform float ratio;\
		uniform vec4 finalColorMask;\
		'+MotionTrackerDevice.commonShaderCode+'\
		'+MotionTrackerDevice.signalFunc+'\
		void main(void)\
		{\
			vec4 tex = texture2D(uSampler, vTextureCoord);\
			vec2 rc = 2.*(vTextureCoord*vec2(1., 1./ratio)-vec2(.5));\
			vec2 d = normalize(rc);\
			float s = signal(speed*time);\
			s = s>0.05?(tex.a*pow(clamp(1.-length(vTextureCoord*vec2(1., 1./ratio)-(s*d+vec2(.5)))-.75, 0., 1.)*4., 16.)):0.;\
			s *= 1.+log(-fract(speed*time)+1.);\
			gl_FragColor = mix(vec4(tex.rgb, 1.), vec4(1.), s);\
			gl_FragColor = finalColorMask*gl_FragColor;\
			if(applyGlitch)\
			{\
				float g = oldScreenGlitch(vTextureCoord, 1024., time);\
				gl_FragColor = (1.-g)*gl_FragColor+g;\
			}\
		}';
	static fragShaderAriousPostProcess = '\
		varying vec2 vTextureCoord;\
		uniform sampler2D uSampler;\
		uniform float time;\
		uniform float ratio;\
		uniform float scaleGlitch;\
		/*uint hash( uint x )\
		{\
			x += ( x << 10u );\
			x ^= ( x >>  6u );\
			x += ( x <<  3u );\
			x ^= ( x >> 11u );\
			x += ( x << 15u );\
			return x;\
		}\
		uint hash( uvec2 v ) { return hash(v.x ^ hash(v.y)); }\
		float uintToFloat(uint m)\
		{\
			return uintBitsToFloat(0x3F800000u|(m&0x007FFFFFu) ) - 1.0;\
		}\
		float random( vec2  v ) { return uintToFloat(hash(vec2(floatBitsToUint(v.x), floatBitsToUint(v.y)))); }\
		float hash(vec2 uv) \
		{\
			uv = vec2(dot(uv, vec2(143.9843084, 324.39290843093)), dot(uv, vec2(-43.24392108, 17.320984398344)));\
			return fract((1.+sin(uv.x))*(1.+cos(uv.y)));\
		}*/\
		float noise(in vec2 xy, in float seed)\
		{\
		       return fract(tan(distance(xy*1.61803398874989484820459, xy)*seed)*xy.x);\
		}\
		float hash1D(float x)\
		{\
			return fract(abs(x)*1938.32179045493754903);\
		}\
		float smooth(float x)\
		{\
			float lower = floor(x);\
			float frac = fract(x);\
			float f = frac*frac*(3.0-2.0*frac);\
			return mix(hash1D(lower-0.5), hash1D(lower+0.5), f);\
		}\
		float fbm(float x)\
		{\
		    float total = 0.0;\
		    total += 0.5000*smooth(x); x*=2.001;\
		    total += 0.2500*smooth(x); x*=2.003;\
		    total += 0.1250*smooth(x); x*=2.002;\
		    total += 0.0625*smooth(x); x*=2.001;\
		    return clamp(total, 0.0, 1.0);\
		}\
		void main(void)\
		{\
			vec2 uv = vTextureCoord;\
			float f = pow(fbm(0.05*time), 32.)*2048.;\
			uv.x = uv.x+scaleGlitch*clamp(0.2*f*sin(4.*3.14*uv.y+time), -0.2, 0.2);\
			vec4 tex = texture2D(uSampler, uv);\
			vec4 c1 = vec4(.541, .824, .514, 1.);\
			vec4 c2 = vec4(.482, 1.0, .471, 1.);\
			vec4 c3 = vec4(.188, .290, .180, 1.);\
			float lc = 2.*length(vTextureCoord*vec2(1., 1./ratio)-vec2(.3));\
			gl_FragColor = mix(c2,c3,lc)+c1*tex;\
		}';
	// END SHADER BLOCK
	static RATIO = 0.944; /* width of the background texture over its height */
	static TRACK_SPEED = 0.01;
	static uniformsBackground = {applyGlitch: false, time: 0., speed: MotionTrackerDevice.TRACK_SPEED, centerx: 0., centery: 0., ratio: 1., finalColorMask: new Float32Array([1., 1., 1., 1.]), uSampler: null};
	static uniformsPing = {time: 0., speed: MotionTrackerDevice.TRACK_SPEED, emissive: 1., centerx: 0., centery: 0., distmax: 0.};
	static uniformPostProcess = {time: 0., ratio: 1., scaleGlitch: 1.};

	static SCREEN_ADDITIONAL_TEXEL_HEIGHT = 64;
	static SCREEN_ADDITIONAL_CANVAS_HEIGHT = 64./1024;
	static BACKGROUND_MT_PADDING_SCALE_TOTAL = 0.125;

	static STATUS_MOTIONLESS = {
		id: 'MotionTracker.motionless',
		label: 'MotionTracker.motionless',
		icon: 'modules/motion_tracker/textures/motion_tracker_status_ico.webp'
	};

	static STATUS_MANDATORY = [MotionTrackerDevice.STATUS_MOTIONLESS.id, CONFIG.Combat.defeatedStatusId];

	static THEME_LIST = ['M314', 'Arious'];
	static THEMES_DATA =
	{
		M314:
		{
			textColor: 0x994d1a,
			textPosition: 'bottom-center',
			emissive: 1.,
			shaders:
			{
				background: MotionTrackerDevice.fragShaderM314Background,
				postProcess: null
			}
		},
		Arious:
		{
			textColor: 0x8ad283,
			textPosition: 'bottom-left',
			emissive: 2.,
			shaders:
			{
				background: MotionTrackerDevice.fragShaderM314Background,
				postProcess: MotionTrackerDevice.fragShaderAriousPostProcess
			}
		}
	};

	constructor(element_container, cbIsReady, config)
	{
		MotionTrackerDevice.uniformsPing.time = 0.0;
		MotionTrackerDevice.uniformsBackground.time = 0.0;
		MotionTrackerDevice.uniformPostProcess.time = 0.0;
		MotionTrackerDevice.uniformPostProcess.scaleGlitch = MotionTracker.ALL_CONFIG().rendering.enablePostProcess?1.:0.;
		//private variables
		this.container = element_container;
		this.dimensions = config.dimensions;
		this.config = config;
		this.tokenReference = null;

		this.enableInverseStatus = MotionTracker.CONFIG.general.enableInverseStatus;

		this.user = null;

		this.signals = [];
		this.bMakeFakeSignals = false;
		this.bApplyGlitchScreen = false;
		this.signalsMax = 20;

		this.cbIsReady = cbIsReady;

		const SIZE = game.settings.get(settings.REGISTER_CODE, 'size');
		
		const distanceMax = game.settings.get(settings.REGISTER_CODE,'maxDistance');
		MotionTrackerDevice.uniformsPing.distmax = distanceMax;
		this.distUnitPerPx = SIZE*.5/distanceMax;

		this.fakeSignals = [];
		for(let i = 0; i<10; ++i)
			this.fakeSignals.push({x: (-1.+2.*Math.random())*distanceMax*.8, y: (-1.+2.*Math.random())*distanceMax*.8});

		this.pingSoundLock = false;
		this.waveSoundLock = false;
		const conf = MotionTracker.ALL_CONFIG();
		this.volume = conf.audio.volume;
		this.bMute = conf.audio.muted;
		// Renderer specific
		const configTheme = MotionTrackerDevice.THEMES_DATA[conf.general.theme];
		this.pixi = {
			app: null,
			sprite_background: null,
			sprites_signals: [],
			filter_ping: new PIXI.Filter(MotionTrackerDevice.vertShaderPing, MotionTrackerDevice.fragShaderPing, MotionTrackerDevice.uniformsPing),
			distanceMessage: new PIXI.Text('',
			{
				fontFamily : 'Roboto',
				fontSize: Math.max(12, 32*(SIZE-settings.MIN_SIZE)/(settings.MAX_SIZE-settings.MIN_SIZE)),
				fontWeight: 'bold',
				fill : configTheme.textColor,
				align : 'center'
			})
		};

		// data
		this.textures =
		{
			background:
			{
				M314: 'modules/motion_tracker/textures/motion_tracker_m314_background.png',
				Arious:  'modules/motion_tracker/textures/motion_tracker_arious_background.png'
			},
			ping: 'modules/motion_tracker/textures/motion_tracker_ping.webp',
		};
		this.loadTextures();
	}

	async loadTextures()
	{
		// PIXI can handle this being called when textures are already loaded
		await PIXI.Assets.load(this.textures.background.M314);
		await PIXI.Assets.load(this.textures.background.Arious);
		await PIXI.Assets.load(this.textures.ping);
		this.loadTexturesFinish()
	}

	async loadTexturesFinish()
	{
		const SIZE = game.settings.get(settings.REGISTER_CODE, 'size');
		
		const distanceMax = game.settings.get(settings.REGISTER_CODE,'maxDistance');
		this.distUnitPerPx = SIZE*.5/distanceMax;
		
		const conf = MotionTracker.ALL_CONFIG();

		const configTheme = MotionTrackerDevice.THEMES_DATA[conf.general.theme];

		//Create the `cat` sprite
		PIXI.utils.TextureCache[this.textures.background[conf.general.theme]].baseTexture.alphaMode = PIXI.ALPHA_MODES.NO_PREMULTIPLIED_ALPHA;
		PIXI.utils.TextureCache[this.textures.background[conf.general.theme]].baseTexture.update();
		if(this.pixi.sprite_background===null)
		{
			MotionTrackerDevice.uniformsBackground.uSampler = PIXI.utils.TextureCache[this.textures.background[conf.general.theme]];
			const backgroundShdr = PIXI.Shader.from(null, configTheme.shaders.background, MotionTrackerDevice.uniformsBackground);
			const QuadGeometry = new PIXI.Geometry()
			    .addAttribute('aVertexPosition', // the attribute name
				[
					0, 0, // x, y
					SIZE, 0, // x, y
					SIZE, SIZE+MotionTrackerDevice.SCREEN_ADDITIONAL_CANVAS_HEIGHT,
					0, SIZE+MotionTrackerDevice.SCREEN_ADDITIONAL_CANVAS_HEIGHT
				], // x, y
				2) // the size of the attribute
			    .addAttribute('aTextureCoord', // the attribute name
				[
					0, 0, // u, v
					1, 0, // u, v
					1, 1,
					0, 1
				], // u, v
				2) // the size of the attribute
			    .addIndex([0, 1, 2, 0, 2, 3]);
			this.pixi.sprite_background = new PIXI.Mesh(QuadGeometry, backgroundShdr);
		}
		
		this.pixi.sprite_background.x = 0;
		this.pixi.sprite_background.y = 0;

		if(this.pixi.sprites_signals.length==0)
		{
			for(let i = 0;i<this.signalsMax;++i)
			{
				this.pixi.sprites_signals[i] = new PIXI.Sprite(PIXI.utils.TextureCache[this.textures.ping]);
				this.pixi.sprites_signals[i].x = 0;
				this.pixi.sprites_signals[i].y = 0;
				this.pixi.sprites_signals[i].anchor.set(0.5, 0.5);
				this.pixi.sprites_signals[i].visible = false;
				this.pixi.sprites_signals[i].filters = [this.pixi.filter_ping];
				this.pixi.sprites_signals[i].width = Math.max(32, SIZE/32*this.distUnitPerPx);
				this.pixi.sprites_signals[i].height = Math.max(32, SIZE/32*this.distUnitPerPx);
			}
		}

		await this.container!==null;

		// PIXI context creation
		if(this.pixi.app === null)
		{
			this.pixi.app = new PIXI.Application(
				{
					width: SIZE, height: SIZE+MotionTrackerDevice.SCREEN_ADDITIONAL_CANVAS_HEIGHT,
					backgroundColor: 0x000000ff, clearBeforeRender: true
				});
		}
		
		this.pixi.app.stage.removeChildren();

		this.container.appendChild(this.pixi.app.view);

		// setup base
		this.pixi.app.renderer.background.color = 0x000000;
		this.pixi.app.renderer.clear();
		const backgroundAndPings = new PIXI.Container();
		backgroundAndPings.width = SIZE;
		backgroundAndPings.height = SIZE+MotionTrackerDevice.SCREEN_ADDITIONAL_CANVAS_HEIGHT;
		
		this.pixi.sprite_background.blendMode = PIXI.BLEND_MODES.ADD;
		backgroundAndPings.addChild(this.pixi.sprite_background);
		for(let i = 0;i<this.pixi.sprites_signals.length;++i)
		{
			backgroundAndPings.addChild(this.pixi.sprites_signals[i]);
		}
		if(configTheme.shaders.postProcess!==null)
		{
			const filter = new PIXI.Filter(null, configTheme.shaders.postProcess, MotionTrackerDevice.uniformPostProcess);
			this.pixi.app.stage.filters = [filter];
		}
		this.pixi.distanceMessage.anchor.set(0.5, 0.5);
		this.pixi.app.stage.addChild(backgroundAndPings);
		this.pixi.app.stage.addChild(this.pixi.distanceMessage);
		this.pixi.app.ticker.add(this.update, this);
		this.cbIsReady();
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
			this.pixi.app.renderer.resize(size, size+MotionTrackerDevice.SCREEN_ADDITIONAL_CANVAS_HEIGHT);
		}
	}

	computeTokenCenter(token)
	{
		return {
			x:0.5*token.width+token.x,
			y:0.5*token.height+token.y
		};
	}

	update(delta)
	{
		if(this.user===null || this.tokenReference===null || this.tokenReference===undefined)
		{
			MotionTrackerDevice.uniformsBackground.finalColorMask = new Float32Array([1., .5, .5, .5]);
			return;
		}
		// wipe precedent signals
		this.signals.length = 0;

		const scene = game.scenes.get(this.viewedSceneId);
		const tokens = scene.tokens;
		const bSeePlayers = game.settings.get(settings.REGISTER_CODE,'seePlayers');
		const distanceMax = game.settings.get(settings.REGISTER_CODE,'maxDistance');
		const SIZE = game.settings.get(settings.REGISTER_CODE,'size');
		const conf = MotionTracker.ALL_CONFIG();
		this.distUnitPerPx = SIZE*.5/distanceMax;
		MotionTrackerDevice.uniformsPing.distmax = distanceMax;
		const immobileStatuses = [...new Set([...MotionTrackerDevice.STATUS_MANDATORY, ...conf.statusFilters])];
		const pos = this.computeTokenCenter(this.tokenReference);

		let nearestDist = distanceMax;
		let playerIds = [];
		for(let i = 0;i<game.users._source.length;++i)
		{
			if(game.users._source[i].role<4)
				playerIds.push(game.users._source[i]._id);
		}
		tokens.forEach(token => 
			{
				let immobile = undefined;
				let actor = token.actor;
				let bPlayerControlled = false;
				if(actor!==null)
				{
					for(let i = 0;i < playerIds.length;++i)
					{
						bPlayerControlled = bPlayerControlled || actor.permission[playerIds[i]]>2;
					}
				}
				// v11 introduces proper statuses for actors, immobileStatuses comes from player configuration
				if(actor!==null && actor!== undefined && immobile===undefined)
				{
					immobile = actor.statuses?.find(e=> immobileStatuses.some(s=>s===e));
				}

				if(this.enableInverseStatus && immobile !==undefined)
					immobile = !immobile;
				else if(this.enableInverseStatus)
				{
					immobile = true;
				}

				if(
					(bSeePlayers && !immobile && token.id!==this.tokenReference.id)
					|| (!bSeePlayers && !bPlayerControlled && !immobile && token.id!==this.tokenReference.id)
				)
				{
					const oPos = this.computeTokenCenter(token);
					oPos.x = (oPos.x-pos.x)/scene.grid.size;
					oPos.y = (oPos.y-pos.y)/scene.grid.size;
					const normDir = (Math.abs(oPos.x)<0.01 && Math.abs(oPos.y)<0.01)?0.01:Math.sqrt(oPos.x*oPos.x+oPos.y*oPos.y);
					let scanResult = { distance: scene.grid.distance*normDir, dir: { x: oPos.x/normDir, y: oPos.y/normDir } };
					nearestDist = Math.min(nearestDist, scanResult.distance);
					if(scanResult.distance<distanceMax)
						this.signals.push(scanResult);
				}
			}
		);
		if(this.bMakeFakeSignals)
		{
			for(let i = 0; i<Math.max(0, this.signalsMax-this.signals.length); ++i)
			{
				const oPos = this.fakeSignals[i];
				let newPos = {x:(oPos.x-pos.x)/scene.grid.size, y:(oPos.y-pos.y)/scene.grid.size};
				const normDir = (Math.abs(newPos.x)<0.01 && Math.abs(newPos.y)<0.01)?0.01:Math.sqrt(newPos.x*newPos.x+newPos.y*newPos.y);
				let scanResult = { distance: scene.grid.distance*normDir, dir: { x: newPos.x/normDir, y: newPos.y/normDir } };
				nearestDist = Math.min(nearestDist, scanResult.distance);
				if(scanResult.distance<distanceMax)
					this.signals.push(scanResult);
			}
		}
		const centerCanvas = {x: .5*this.pixi.app.stage.width, y:.5*this.pixi.app.stage.width }; // no longer height due to additional space, the MT is square
		for(let i = 0;i<this.pixi.sprites_signals.length;++i)
		{
			if(i<this.signals.length)
			{
				this.pixi.sprites_signals[i].visible = true;
				this.pixi.sprites_signals[i].x = this.distUnitPerPx*this.signals[i].dir.x*this.signals[i].distance+centerCanvas.x;
				this.pixi.sprites_signals[i].y = this.distUnitPerPx*this.signals[i].dir.y*this.signals[i].distance+centerCanvas.y-MotionTrackerDevice.SCREEN_ADDITIONAL_CANVAS_HEIGHT*centerCanvas.y;
			}
			else
				this.pixi.sprites_signals[i].visible = false;
		}
		
		{
			const configTheme = MotionTrackerDevice.THEMES_DATA[conf.general.theme];
			
			if(configTheme.textPosition==='bottom-center')
			{
				this.pixi.distanceMessage.x = centerCanvas.x;
			}
			else
			{
				this.pixi.distanceMessage.x = .25*centerCanvas.x;
			}
			this.pixi.distanceMessage.y = this.pixi.app.stage.height-5.-32.*(this.pixi.app.stage.width-settings.MIN_SIZE)/(settings.MAX_SIZE-settings.MIN_SIZE);
		}
		
		let x = MotionTrackerDevice.uniformsPing.time*MotionTrackerDevice.uniformsPing.speed;
		function fract(x)
		{
			return x-Math.trunc(x);
		}
		x = fract(x);
		x = Math.max(fract(3.*x)*Math.min(1., Math.floor(3.*fract(x))),
			Math.floor(.5*(Math.ceil(3.*x)-1.))
		);

		// deplay sounds by 0.1
		if(!this.bMute)
		{
			if(x>0.1 && x<0.2 && !this.waveLock)
			{
				this.waveLock = true
				AudioHelper.play({ src:conf.audio.wave.src, volume: conf.audio.wave.volume * this.volume, autoplay: true }, false)
				// Timeout should follow length of audio, with a few extra ms
				setTimeout(() => this.waveLock = false, 200)
			}
			if(x*distanceMax>nearestDist && !this.soundLock)
			{
				let sound = conf.audio.far;
				if(nearestDist<0.33*distanceMax)
					sound = conf.audio.close;
				else if(nearestDist<0.66*distanceMax)
					sound = conf.audio.medium;
				else
					sound = conf.audio.far;

				this.soundLock = true
				AudioHelper.play({ src:sound.src, volume: sound.volume * this.volume, autoplay: true }, false)
				// Timeout should follow length of audio, with a few extra ms
				setTimeout(() => this.soundLock = false, 1200)
			}
		}

		if(x*distanceMax>nearestDist)
		{
			this.pixi.distanceMessage.text = nearestDist.toFixed(2)+scene.grid.units;
			this.pixi.distanceMessage.alpha = x;
		}
		else
		{
			this.pixi.distanceMessage.text = '0'+scene.grid.units;
			this.pixi.distanceMessage.alpha = 1.-x;
		}

		MotionTrackerDevice.uniformsBackground.applyGlitch = this.bApplyGlitchScreen;
		MotionTrackerDevice.uniformsBackground.time += delta;
		MotionTrackerDevice.uniformsBackground.speed = conf.general.speed;
		MotionTrackerDevice.uniformsBackground.centerx = centerCanvas.x;
		MotionTrackerDevice.uniformsBackground.centery = centerCanvas.y;
		MotionTrackerDevice.uniformsBackground.ratio = MotionTrackerDevice.RATIO;
		MotionTrackerDevice.uniformsBackground.finalColorMask = new Float32Array([1., 1., 1., 1.]);
		MotionTrackerDevice.uniformsPing.time+=delta;
		MotionTrackerDevice.uniformsPing.speed = MotionTrackerDevice.uniformsBackground.speed;
		MotionTrackerDevice.uniformsPing.centerx = centerCanvas.x;
		MotionTrackerDevice.uniformsPing.centery = centerCanvas.y*MotionTrackerDevice.uniformsBackground.ratio;
		MotionTrackerDevice.uniformsPing.emissive = MotionTrackerDevice.THEMES_DATA[conf.general.theme].emissive;
		MotionTrackerDevice.uniformPostProcess.time += delta;
		MotionTrackerDevice.uniformPostProcess.ratio = MotionTrackerDevice.uniformsBackground.ratio;
		MotionTrackerDevice.uniformPostProcess.scaleGlitch = conf.rendering.enablePostProcess?1.:0.;
	}

	setData(user = game.user, tokenId, viewedSceneId)
	{
		this.user = user;
		this.tokenReference = null;
		this.viewedSceneId = viewedSceneId;
		const scene = game.scenes.get(this.viewedSceneId);
		if(scene!==null && scene!==undefined)
		{
			const tokens = scene.tokens;
			if(tokens.size>0)
				this.tokenReference = tokens.find(tok => tok.actorId === tokenId);
			this.recomputeFakedSignals();
		}
	}

	recomputeFakedSignals()
	{
		if(this.tokenReference !== undefined && this.tokenReference != null)
		{
			const scene = game.scenes.get(this.viewedSceneId);
			const tokenPos = this.computeTokenCenter(this.tokenReference);
			const span = scene.grid.size * .5 * game.settings.get(settings.REGISTER_CODE,'maxDistance');
			let lowerLimit = {x:tokenPos.x-span, y:tokenPos.y-span};
			let upperLimit = {x:tokenPos.x+span, y:tokenPos.y+span};
			for(let i = 0; i <this.signalsMax;++i)
			{
				this.fakeSignals[i] = {
					x: (lowerLimit.x+(upperLimit.x-lowerLimit.x)*Math.random()),
					y: (lowerLimit.y+(upperLimit.y-lowerLimit.y)*Math.random())};
			}
		}
	}

	getFakedSignals()
	{
		return this.fakeSignals;
	}

	isMuted()
	{
		return this.bMute;
	}

	mute()
	{
		this.bMute = true;
	}

	unMute()
	{
		this.bMute = false;
	}

	stop()
	{
		this.pixi.app.ticker.remove(this.update, this);
		this.pixi.app.ticker.stop();
		this.pixi.app.ticker.destroy();
	}

	onSettingsChange(data)
	{
		this.volume = data.audio.volume;
		this.enableInverseStatus = MotionTracker.CONFIG.general.enableInverseStatus;
	}
}
