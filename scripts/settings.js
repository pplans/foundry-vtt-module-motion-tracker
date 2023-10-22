import {MotionTracker} from './motion_tracker.js'
import { MotionTrackerDevice } from './motion_tracker_device.js';

export function registerSettings(callbackResize)
{
  gmOnly_Settings(callbackResize);
}

export const VERSION = '0.5.0';
export const REGISTER_CODE = 'motion_tracker';
export const MIN_SIZE = 64;
export const MAX_SIZE = 512;
export const MAX_PING_SIZE = 64;
export const PATH = "modules/motion_tracker/";
export const TEMPLATE_PATH = `${PATH}templates`;

function gmOnly_Settings(callbackResize)
{

	game.settings.register(REGISTER_CODE, 'enabled',
	{
		scope: 'world',
		type: Boolean,
		default: true,
		config: false
	});

	game.settings.register(REGISTER_CODE,'gmOnly',
	{
		name : 'MOTIONTRACKER.gmOnlyTitle',
		hint : 'MOTIONTRACKER.gmOnlyHint',
		scope :'world',
		config : true,
		default : true,
		type : Boolean
	});

	game.settings.register(REGISTER_CODE,'seePlayers',
	{
		name : 'MOTIONTRACKER.seePlayersTitle',
		hint : 'MOTIONTRACKER.seePlayersHint',
		scope :'world',
		config : true,
		default : true,
		type : Boolean
	});

	game.settings.register(REGISTER_CODE,'size',
	{
		name : 'MOTIONTRACKER.sizeTitle',
		hint : 'MOTIONTRACKER.sizeHint',
		scope :'world',
		config : true,
		type: Number,
		default: 200,
		range: {
		    min: MIN_SIZE,
		    max: MAX_SIZE,
		    step: 10
		},
		onChange: settings =>
		{
			callbackResize(settings)
		}
	});

	game.settings.register(REGISTER_CODE,'maxDistance',
	{
		name : 'MOTIONTRACKER.maxDistanceTitle',
		hint : 'MOTIONTRACKER.maxDistanceHint',
		scope :'world',
		config : true,
		type: Number,
		default: 80,
		range: {
		    min: 5,
		    max: 100,
		    step: 1
		}
	});

	game.settings.registerMenu(REGISTER_CODE, 'motion_tracker', {
	    name: 'MOTIONTRACKER.config',
	    label: 'MOTIONTRACKER.configTitle',
	    hint: 'MOTIONTRACKER.configHint',
	    icon: 'fas motion-tracker-ico',
	    type: MotionTrackerConfig,
	    restricted: false
	});

	game.settings.register(REGISTER_CODE, 'settings', {
	    name: 'Motion Tracker Settings',
	    scope: 'world',
	    default: MotionTracker.DEFAULT_OPTIONS,
	    type: Object,
	    config: false
	});
}

/**
 * Form application to configure settings of the Motion Tracker.
 */
class MotionTrackerConfig extends FormApplication
{
	static get defaultOptions() {
		return mergeObject(super.defaultOptions,
		{
			title: game.i18n.localize("MOTIONTRACKER.configTitle"),
			id: "motion-tracker-config",
			template: `${TEMPLATE_PATH}/motion_tracker_config.html`,
			width: 500,
			height: "auto",
			closeOnSubmit: true,
			tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "general"}]
		})
	}

	getData(options)
	{
		let data = mergeObject(MotionTracker.CONFIG, game.settings.get(REGISTER_CODE, 'settings'), { insertKeys: false, insertValues: false });
		data.general.enableFastTokenChangeChecked = data.general.enableFastTokenChange?'checked':'';
		data.rendering.enablePostProcessChecked = data.rendering.enablePostProcess?'checked':'';
		data.audio.mutedChecked = data.audio.muted?'checked':'';
		data.statusFiltersExt = [];
		CONFIG.statusEffects.forEach(s => {
			data.statusFiltersExt.push({
				id: s.id,
				label: game.i18n.localize(s.label),
				icon: s.icon,
				status: MotionTrackerDevice.STATUS_MANDATORY.find(id=> id===s.id)?'mandatory':(data.statusFilters.find(id => id===s.id)!==undefined?'selected':'')
			});
		});
		data.isGM = game.user.hasRole(CONST.USER_ROLES.ASSISTANT);
		data.general.themelist = [];
		MotionTrackerDevice.THEME_LIST.forEach(t => data.general.themelist.push({value: t, selected:t===data.general.theme?'selected':''}));
		return data;
	}

	activateListeners(html)
	{
		super.activateListeners(html);
		html.find('button[name="reset"]').click(this._onReset.bind(this));
		html.find('.status-item').click(event =>
			{
				event.preventDefault();
				let element = $(event.currentTarget);
				if(element.hasClass('mandatory'))
				{
					return;
				}
				else if(element.hasClass('selected'))
				{
					element.removeClass('selected');
					element.next().val('');
				}
				else
				{
					element.addClass('selected');
					element.next().val('selected');
				}
			});
		html.find('file-picker').click(event =>
		{
			event.preventDefault();
			let target = button.getAttribute('data-target');
			let fp = FilePicker.fromButton(button);
			this.filepickers.push({
				target: target,
				app: fp
			});
			fp.browse();
		});
	}

	_onReset(event)
	{
		event.preventDefault();
		Dialog.confirm({
			title: game.i18n.localize('MOTIONTRACKER.SettingsConfirmTitle'),
			content: `<p>${game.i18n.localize('MOTIONTRACKER.SettingsConfirmContent')}</p>`,
			yes: () => 
			{
				game.settings.set(REGISTER_CODE, 'settings', MotionTracker.DEFAULT_OPTIONS);
				this.render();
			},
			no: () => {},
			defaultYes: false
		       });
	}

	async _updateObject(event, formData)
	{
		let statusFiltersTraited = [];
		Object.entries(formData).forEach(e =>
			{
				let found = e[0].match(/statusFilters\[(?<id>.*)\]/);
				if(found!==null && found.groups!==null && e[1]==='selected')
				{
					statusFiltersTraited.push(found.groups.id);
				}
			});
		let data =
		{
			general:
			{
				speed: formData['scan-speed'],
				theme: formData['theme'],
				enableFastTokenChange: formData['enableFastTokenChange']
			},
			statusFilters: statusFiltersTraited,
			rendering:
			{
				enablePostProcess: formData['enablePostProcess']
			},
			audio:
			{
				muted: formData['muted'],
				volume: formData['volume-main'],
				wave: { volume: formData['volume-wave'], src: formData['path-wave'] },
				close: { volume: formData['volume-close'], src: formData['path-close'] },
				medium: { volume: formData['volume-medium'], src: formData['path-medium'] },
				far: { volume: formData['volume-far'], src: formData['path-far'] }
			}
		};

		let settings = mergeObject(MotionTracker.CONFIG, data, { insertKeys: false, insertValues: false });

		if(game.motion_tracker)
		{
			game.motion_tracker.onSettingsChange(settings);
		}

		await game.settings.set(REGISTER_CODE, 'settings', settings);
	}

	close(options)
	{
		super.close(options);
	}
}