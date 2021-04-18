import * as settings from './settings.js';
import {MotionTrackerDevice} from './motion_tracker_device.js'

console.log("Motion Tracker Module Loaded");

export function renderMotionTrackerIcon()
{
	if(game.user.isGM || !game.settings.get(settings.REGISTER_CODE, 'gmOnly'))
	{
		const lang_html = $(`
		<a class="chat-control-icon motion_tracker-dialog-button" title="Run Motion Tracker" style="margin-right: 7px">
			<i class="fas motion-tracker-ico"></i>
		</a>
		`);
		jQuery("#chat-controls label").before(lang_html);
		jQuery('a.motion_tracker-dialog-button').click(() => { game.motion_tracker.toggle({}); });
	}
}

Hooks.on('init', ()=>
{
	// set up the mutation observer
	let observer = new MutationObserver(function (mutations, me)
	{
		// `mutations` is an array of mutations that occurred
		// `me` is the MutationObserver instance
		let chatControls = document.getElementById('chat-controls');
		if (chatControls && game.user)
		{
			renderMotionTrackerIcon();
			if(game.motion_tracker===undefined || game.motion_tracker===null)
			{
				game.motion_tracker = new MotionTracker();
			}
			me.disconnect(); // stop observing
			return;
		}
	});
	
	// start observing
	observer.observe(document, {
	  childList: true,
	  subtree: true
	});

	settings.registerSettings((data)=>
	{
		if(game.motion_tracker)
		{
			game.motion_tracker.resize(data);
		}
	});
});

Hooks.on('ready', ()=>
{
	console.log("Motion Tracker Module 'ready' hook");
});

/**
 * Main class to handle Motion Tracker Device.
 */
 export class MotionTracker
 {
	static get DEFAULT_OPTIONS()
	{
		return {
			speed: 0.01,
			sounds: true,
			soundsVolume: 0.5,
			useHighDPI:true,
			audio:
			{
				muted: false,
				volume: 1.,
				wave: {volume: 1., src: 'modules/motion_tracker/sounds/motion_tracker_wave.ogg'},
				close: {volume: 1., src: 'modules/motion_tracker/sounds/motion_tracker_ping_close.ogg'},
				medium: {volume: 1., src: 'modules/motion_tracker/sounds/motion_tracker_ping_medium.ogg'},
				far: {volume: 1., src: 'modules/motion_tracker/sounds/motion_tracker_ping_far.ogg'}
			}
		};
	}
    
	static DEFAULT_APPEARANCE(user = game.user)
	{
		return { dimensions: { w: game.settings.get(settings.REGISTER_CODE, 'size'), h: game.settings.get(settings.REGISTER_CODE, 'size') } };
	}
    
	static ALL_DEFAULT_OPTIONS(user = game.user)
	{
		return mergeObject(MotionTracker.DEFAULT_OPTIONS, MotionTracker.DEFAULT_APPEARANCE(user));
	}
    
	static get CONFIG()
	{
		return mergeObject(MotionTracker.DEFAULT_OPTIONS, game.settings.get(settings.REGISTER_CODE, 'settings'));
	}
    
	static APPEARANCE(user = game.user)
	{
		let userAppearance = user.getFlag(settings.REGISTER_CODE, 'appearance');
		return mergeObject(MotionTracker.DEFAULT_APPEARANCE(user), userAppearance);
	}
    
	static ALL_CUSTOMIZATION(user = game.user)
	{
		return MotionTracker.APPEARANCE(user);
	}
    
	static ALL_CONFIG(user = game.user)
	{
		return mergeObject(MotionTracker.CONFIG, MotionTracker.APPEARANCE(user));
	}
    
	/**
	 * Ctor. Create and initialize a new motion tracker.
	 */
	constructor()
	{
		this.window = null;
		this._buildWindow();
		this._initListeners();
		this._welcomeMessage();
	}
    
	/**
	 * Create the window that will host the canvas.
	 *
	 * @private
	 */
	_buildWindow()
	{
		this.window = new MotionTrackerWindow();
		this.currentCanvasPosition = MotionTracker.CONFIG.canvasZIndex;
		this.currentUseHighDPI = MotionTracker.CONFIG.useHighDPI;
	}
    
	/**
	 * Init listeners on windows resize and on click if auto hide has been disabled within the settings.
	 *
	 * @private
	 */
	_initListeners()
	{
		game.socket.on('module.motion_tracker', (request) =>
		{
			switch(request.type)
			{
				case 'open':
					this.open(request.user, request.ownerId, request.tokenReferenceId, request.viewedSceneId);
				break;
				case 'close':
					this.close();
				break;
				case 'update':
				break;
			}
		});
	}
    
	/**
	 * Show a private message to new players
	 */
	_welcomeMessage()
	{
		if(!game.user.getFlag(settings.REGISTER_CODE,'welcomeMessageShown'))
		{
			if(!game.user.getFlag(settings.REGISTER_CODE,'appearance'))
			{
				renderTemplate("modules/motion_tracker/templates/welcomeMessage.html", {}).then((html)=>
				{
					let options = {
						whisper:[game.user.id],
						content: html
					};
					ChatMessage.create(options);
				});
			}
			game.user.setFlag(settings.REGISTER_CODE,'welcomeMessageShown',true);
		}
	}
    
	/**
	 * Check if 3D simulation is enabled from the settings.
	 */
	isEnabled()
	{
		return MotionTracker.CONFIG.enabled && game.settings.get(settings.REGISTER_CODE, 'enabled');
	}
    
	/**
	 * Update the device with fresh new settings.
	 *
	 * @param settings
	 */
	update(settings)
	{
		this.window.update(settings);
	}
    
	/**
	 * Show the motion tracker animation based on data configuration made by the User.
	 *
	 * @param user the user who made the call (game.user by default).
	 * @param synchronize
	 * @param users list of users or userId who can see the roll, leave it empty if everyone can see.
	 * @param blind if the call is blind for the current user
	 * @returns {Promise<boolean>} when resolved true if the animation was displayed, false if not.
	 */
	async open(user = game.user, ownerId = game.user.id, tokenId = null, viewedScene = game.user.viewedScene)
	{
		if(tokenId === null && canvas.tokens.controlled.length>0)
			tokenId = canvas.tokens.controlled[0].data._id;
		this.window.setData(user, ownerId, tokenId, viewedScene);
		await this.window.render(true);
		return new Promise((resolve, reject) =>
		{
			resolve();
		});
	}
	close()
	{
		return new Promise((resolve, reject) =>
		{
			this.window.close();
			resolve();
		});
	}

	resize(size)
	{
		if(this.window!==null && this.window!==undefined)
			this.window.resize(size);
	}

	toggle()
	{
		if(this.window.rendered)
			this.close(true);
		else
			this.open();
		return this.window.rendered===null;
	}

	onSettingsChange(data)
	{
		this.window.onSettingsChange(data);
	}
}

/**
 * Application window for the MotionTracker
 */
class MotionTrackerWindow extends Application
{
	constructor(options={})
	{
		super(options);
		this.windowElement = null;
		this.canvas = null;
		this.device = null;
		this.user = null;
		this.ownerId = null;
		this.tokenId = null;
		this.viewedSceneId = null;
	}

	static get defaultOptions()
	{
		return mergeObject(super.defaultOptions,
		{
			title: game.i18n.localize('MOTIONTRACKER.MotionTrackerDialogTitle'),
			id: "motion-tracker-window",
			template: "modules/motion_tracker/templates/motion_tracker_window.html",
			width: game.settings.get(settings.REGISTER_CODE, 'size'),
			height: "auto"
		})
	}

	/******************************
	 * @override
	 ******************************/
	getData(options)
	{
		let data = mergeObject(MotionTracker.CONFIG, game.settings.get(settings.REGISTER_CODE, 'settings'), { insertKeys: false, insertValues: false });
		data.ui = {audioMuteIcon: MotionTracker.CONFIG.audio.muted?'motion-tracker-options-unmute-ico':'motion-tracker-options-mute-ico'};
		return data;
	}

	/******************************
	 * @override
	 ******************************/
	async _render(...args)
	{
		// Render the application and restore focus
		await super._render(...args);

		this.windowElement = this.element[0];
		this.windowElement.className += ' motion-tracker-dialog';
		this.canvas = this.element.find('#motion-tracker-canvas')[0];

		// style force
		this.windowElement.style.height = null;
		this.canvas.style.position = null;

		let config = MotionTracker.ALL_CONFIG();
		this.device = new MotionTrackerDevice(this.canvas, config);
		this.device.setData(this.user, this.tokenId, this.viewedSceneId);

		// notify the guys
		if (this.ownerId==game.user.id)
		{
			game.socket.emit('module.motion_tracker', { type:'open', ownerId: this.ownerId, user: this.user, tokenReferenceId: this.tokenId, viewedSceneId: this.viewedScene });
		}
	}
 
	/******************************
	 * @override
	 ******************************/
	activateListeners(html)
	{
		super.activateListeners(html);
		 
		html.find('.motion-tracker-options-toggle').click(
			e => {
				e.preventDefault();
				let contentElement = html.find('#motion-tracker-options-content');
				if(contentElement[0].style.display=='none' || contentElement[0].style.display=='')
				{
					html.find('.motion-tracker-options-open-ico').addClass('motion-tracker-options-close-ico').removeClass('motion-tracker-options-open-ico');
					contentElement[0].style.display='block';
				}
				else
				{
					html.find('.motion-tracker-options-close-ico').addClass('motion-tracker-options-open-ico').removeClass('motion-tracker-options-close-ico');
					contentElement[0].style.display='none';
				}
			}
		);
		html.find('.motion-tracker-options-mute-toggle').click(
			e => {
				e.preventDefault();
				if(this.device && !this.device.isMuted())
				{
					html.find('.motion-tracker-options-mute-ico').addClass('motion-tracker-options-unmute-ico').removeClass('motion-tracker-options-mute-ico');
					this.device.mute();
				}
				else if(this.device)
				{
					html.find('.motion-tracker-options-unmute-ico').addClass('motion-tracker-options-mute-ico').removeClass('motion-tracker-options-unmute-ico');
					this.device.unMute();
				}
			})
		;
	}

	resize(size)
	{
		if(this.windowElement!==null && this.windowElement!==undefined && this.canvas!==null && this.canvas!==undefined)
		{
			this.windowElement.style.width = size+'px';
			this.windowElement.style.minHeight = size+'px';
			this.windowElement.style.height = 'auto';
			if(this.device!==null && this.device!==undefined)
				this.device.resize(size);
		}
	}
 
	close(options)
	{
		if(this.ownerId==game.user.id)
		{
			game.socket.emit('module.motion_tracker', { type:'close' });
		}
		if(this.device)
		{
			this.device.stop();
			delete this.device;
			this.device = null;
		}
		return super.close(options);
	}

	setData(user, ownerId, tokenId, sceneId)
	{
		this.user = user;
		this.ownerId = ownerId;
		this.tokenId = tokenId;
		this.viewedSceneId = sceneId;
	}
    
	/**
	 * Update the device with fresh new settings.
	 *
	 * @param settings
	 */
	update(settings)
	{
		this.device.update(settings);
	}

	onSettingsChange(data)
	{
		if(this.device!==null)
			this.device.onSettingsChange(data);
	}
 }