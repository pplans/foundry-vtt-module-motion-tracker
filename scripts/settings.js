import {MotionTracker} from './motion_tracker.js'
import { MotionTrackerDevice } from './motion_tracker_device.js';

export function registerSettings(callbackResize)
{
  gmOnly_Settings(callbackResize);
}

export const REGISTER_CODE = 'motion_tracker';
export const MIN_SIZE = 64;
export const MAX_SIZE = 512;
export const MAX_PING_SIZE = 64;

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
			template: "modules/motion_tracker/templates/motion_tracker_config.html",
			width: 500,
			height: "auto",
			closeOnSubmit: true,
			tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "general"}]
		})
	}

	getData(options)
	{
		let data = mergeObject(MotionTracker.CONFIG, game.settings.get(REGISTER_CODE, 'settings'), { insertKeys: false, insertValues: false });
		data.audio.mutedChecked = data.audio.muted?'checked':'';

		data.general.themelist = [];
		MotionTrackerDevice.THEME_LIST.forEach(t => data.general.themelist.push({value: t, selected:t===data.general.theme?'selected':''}));
		return data;
	}

	activateListeners(html)
	{
		super.activateListeners(html);
		html.find('button[name="reset"]').click(this._onReset.bind(this));
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
		let data =
		{
			general:
			{
				speed: formData['scan-speed'],
				theme: formData['theme']
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