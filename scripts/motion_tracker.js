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

function getUserDataId(_data)
{
	return _data._id;
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
	console.log('Motion Tracker Module <ready> hook');
	
	CONFIG.statusEffects.push(MotionTrackerDevice.STATUS_MOTIONLESS);
});

Hooks.on('updatePlayer', () =>
{
	if(game.motion_tracker)
	{
		game.motion_tracker._onPlayerUpdate();
	}
});

/**
 * Main class to handle Motion Tracker Device.
 */
 export class MotionTracker
 {
	static get DEFAULT_OPTIONS()
	{
		return {
			sounds: true,
			soundsVolume: 0.5,
			useHighDPI:true,
			statusFilters: ['dead', 'unconscious', 'sleep', 'stun', 'paralysis', 'restrain', 'prone'],
			general:
			{
				speed: MotionTrackerDevice.TRACK_SPEED,
				theme: 'M314'
			},
			rendering:
			{
				enablePostProcess: true
			},
			audio:
			{
				muted: true,
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
			if(game.user.hasRole(CONST.USER_ROLES.ASSISTANT))
			{
				this.window.recvCommand(request);
			}
			if(request.notify!=='notify' && request.senderId!==game.user.id)
			{
				switch(request.type)
				{
					case 'init':
						const owner = game.users.get(request.ownerId);
						if(request.ownerId!==game.user.id && owner.data.role<game.user.role && game.user.hasRole(CONST.USER_ROLES.ASSISTANT))
							this.open(request.user, request.ownerId, request.tokenReferenceId, request.viewedSceneId);
					break;
					case 'open':
						if((request.targetId===null || request.targetId===game.user.id))
							this.open(request.user, request.ownerId, request.tokenReferenceId, request.viewedSceneId);
					break;
					case 'close':
						const sender = game.users.get(request.senderId);
						if((request.targetId===null || request.targetId===game.user.id) && sender.data.role>=game.user.role)
							this.closeAndNotify();
					break;
				}
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
		if(!game.user.getFlag(settings.REGISTER_CODE, settings.VERSION))
		{
			renderTemplate("modules/motion_tracker/templates/updateMessage.html", {}).then((html)=>
			{
				let options = {
					whisper:[game.user.id],
					content: html
				};
				ChatMessage.create(options);
			});
			game.user.setFlag(settings.REGISTER_CODE,settings.VERSION,true);
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

	_onPlayerUpdate()
	{
		if(this.window)
		{
			this.window._onPlayerUpdate();
		}
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
			tokenId = canvas.tokens.controlled[0].document.actorId;
		this.window.setData(user, ownerId, tokenId, viewedScene);
		await this.window.render(true);
		return new Promise((resolve, reject) =>
		{
			resolve();
		});
	}
	close()
	{
		this.window.close();
	}

	closeAndNotify()
	{
		this.window.closeAndNotify();
	}

	resize(size)
	{
		if(this.window!==null && this.window!==undefined)
			this.window.resize(size);
	}

	toggle()
	{
		if(this.window.rendered)
			this.close(game.user.id);
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
		this.playerVisibility = [];
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

	renderPlayerList()
	{
		let jqPlayerList = this.element.find('#motion-tracker-options-player-list');
		if(game.user.hasRole(CONST.USER_ROLES.ASSISTANT) && jqPlayerList.length>0)
		{
			jqPlayerList.empty();
			let playerList = jqPlayerList[0];
			// all button
			{
				let playerItem = document.createElement('div');
				let playerItemLink = document.createElement('a');
				let playerItemIco = document.createElement('i');
				playerItemIco.className='motion-tracker-show';
				playerItemLink.onclick = e=> { this.sendCommand(null, 'open'); };
				playerItemLink.appendChild(playerItemIco);
				playerItemLink.appendChild(document.createTextNode(game.i18n.localize('MOTIONTRACKER.showToAll')));
				playerItem.appendChild(playerItemLink);
				playerList.appendChild(playerItem);
			}
			// per player button
			game.users.forEach(u =>
			{
				if(!u.isSelf)
				{
					let playerItem = document.createElement('div');
					let playerItemLink = document.createElement('a');
					let playerItemIco = document.createElement('i');
					playerItemIco.id = 'motion-tracker-visibility-'+u.id;
					playerItemIco.className='fas '+(this.playerVisibility[u.id]==='open'?'motion-tracker-hide-ico':'motion-tracker-show-ico');
					if(u.data.id==this.ownerId)
					{
						playerItemLink.className += 'motion-tracker-owner';
						playerItemLink.style.color = u.data.color;
					}
					if(!u.active)
					{
						playerItemLink.className = '';
						playerItemLink.style.color = '#888888';
						playerItemLink.style.textDecoration = 'line-through';
					}
					playerItemLink.onclick = e=> { this.sendCommand(u.id, this.playerVisibility[u.id]==='open'?'close':'open'); };
					playerItemLink.appendChild(playerItemIco);
					playerItemLink.appendChild(document.createTextNode(u.data.name));
					playerItem.appendChild(playerItemLink);
					playerList.appendChild(playerItem);
				}
			});
		}
	}

	/******************************
	 * @override
	 ******************************/
	async _render(...args)
	{
		if(this.rendered)
			return;
		// Render the application and restore focus
		await super._render(...args);

		const settingsData = game.settings.get(settings.REGISTER_CODE, 'settings');

		this.windowElement = this.element[0];
		this.windowElement.className += ' motion-tracker-dialog'; // necessary for Weyland mod
		this.windowElement.className += ' '+settingsData.general.theme;
		this.canvas = this.element.find('#motion-tracker-canvas')[0];
		for(let i = 0;i < this.windowElement.children.length; ++i)
		{
			this.windowElement.children[i].className+= ' '+settingsData.general.theme;
		}
		this.element.find('#motion-tracker-options')[0].className+= ' '+settingsData.general.theme;
		this.canvas.className += ' '+settingsData.general.theme;

		// content building
		this.renderPlayerList();

		// style force
		this.windowResetStyle();

		let config = MotionTracker.ALL_CONFIG();
		this.device = new MotionTrackerDevice(this.canvas, this.deviceIsReady.bind(this), config);
		this.device.setData(this.user, this.tokenId, this.viewedSceneId);

		if(this.ownerId===game.user.id)
		{
			this.sendCommand(null, 'init');
		}
		this.sendCommand(game.user.id, 'open', 'notify');
	}

	windowResetStyle()
	{
		this.windowElement.style.width = null;
		this.windowElement.style.height = null;
		this.canvas.style.position = null;
	}

	deviceIsReady()
	{
		const settingsData = game.settings.get(settings.REGISTER_CODE, 'settings');
		this.element.find('canvas')[0].className += ' '+settingsData.general.theme;
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
				this.windowResetStyle();
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

	_onPlayerUpdate()
	{
		if(this.rendered)
			this.renderPlayerList();
	}

	recvCommand(request)
	{
		if(request.targetId==null)
		{
			game.users.forEach(u =>
			{
				if(u.active)
				{
					let type = request.type;
					if(type==='init' && u.hasRole(CONST.USER_ROLES.ASSISTANT))
						type='open';
					else if(type==='init')
						type = 'close';
					this.playerVisibility[u.data.id] = type;
					const classRemoved = type==='open'?'motion-tracker-show-ico':'motion-tracker-hide-ico';
					const classAdded = type==='open'?'motion-tracker-hide-ico':'motion-tracker-show-ico';
					this.element.find('#motion-tracker-visibility-'+u.data.id).addClass(classAdded).removeClass(classRemoved);
				}
				else
				{
					this.playerVisibility[u.data.id] = 'close';
					const classRemoved = 'motion-tracker-hide-ico';
					const classAdded = 'motion-tracker-show-ico';
					this.element.find('#motion-tracker-visibility-'+u.data.id).addClass(classAdded).removeClass(classRemoved);
				}
			});
		}
		else
		{
			let type = request.type;
			this.playerVisibility[request.targetId] = type;
			const classRemoved = type==='open'?'motion-tracker-show-ico':'motion-tracker-hide-ico';
			const classAdded = type==='open'?'motion-tracker-hide-ico':'motion-tracker-show-ico';
			this.element.find('#motion-tracker-visibility-'+request.targetId).addClass(classAdded).removeClass(classRemoved);
		}
		if(request.senderId!==null || request.senderId!==undefined)
		{
			let type = request.type;
			this.playerVisibility[request.senderId] = type;
			const classRemoved = type==='open'?'motion-tracker-show-ico':'motion-tracker-hide-ico';
			const classAdded = type==='open'?'motion-tracker-hide-ico':'motion-tracker-show-ico';
			this.element.find('#motion-tracker-visibility-'+request.senderId).addClass(classAdded).removeClass(classRemoved);
		}
		this.renderPlayerList();
	}

	sendCommand(target, type, notify=null)
	{
		game.socket.emit('module.motion_tracker',
		{
			type: type,
			ownerId: this.ownerId,
			user: this.user,
			tokenReferenceId: this.tokenId,
			viewedSceneId: this.viewedScene,
			targetId: target,
			senderId: game.user.id,
			notify: notify
		});
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
	closeDevice()
	{
		if(this.device)
		{
			this.device.stop();
			delete this.device;
			this.device = null;
		}
	}
 
	closeAndNotify(options)
	{
		this.sendCommand(game.user.id, 'close', 'notify');
		this.closeDevice();
		return super.close(options);
	}
 
	close(options)
	{
		const owner = game.users.get(this.ownerId);
		if(this.ownerId===game.user.id || owner.data.role<game.user.role && game.user.hasRole(CONST.USER_ROLES.ASSISTANT))
		{
			this.sendCommand(null, 'close');
		}
		else
		{
			this.sendCommand(game.user.id, 'close', 'notify');
		}
		this.closeDevice();
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