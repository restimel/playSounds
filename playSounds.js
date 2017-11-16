
const notification = {
	message: '',
	status: 'danger',
	display: false,
	delay: 5000,
	timer: 0,
	show: function(msg, status = 'danger', delay = 5000) {
		this.display = true;
		this.message = msg;
		this.status = status;
		this.delay = delay;
	}
};

const typeSound = {
	type: Object,
	default: null,
	validator: function(value) {
		return !value
		|| (   typeof value.name === 'string'
			&& typeof value.src === 'string'
			&& (value.type === 'url' || value.type === 'file' || value.type === 'recorded')
		   );
	}
};

function saveSounds(data) {
	var json = JSON.stringify(data);

	try {
		localStorage.playSounds = json;
	} catch(e) {
		if (e.name === 'QuotaExceededError') {
			notification.show('Maximum storage limit reached. Modifications are currently not saved in the browser.');
		} else {
			notification.show(e.message);
		}
	}
}

function getSounds() {
	return JSON.parse(localStorage.playSounds || '[]');
}

Vue.directive('keys', {
	bind: function(el, binding) {
		window.addEventListener('keydown', binding.value);
	},
	unbind: function(el, binding) {
		window.removeEventListener('keydown', binding.value);
	}
});

/**
 * v-mouse directive is to handle some mouse event through time
 * v-mouse:time.down.up.click="callback"
 *
 * callback should be a function which will be called when events are triggered
 * It is called with the event (mousedown or mouseup) as first argument.
 *
 * arg: 
 * time (should be a number) is the delay in ms to wait before action. Default to 1000.
 * 
 * modifiers:
 * .down: event is triggered when the mouse button is still down when the delay time is reached
 * .up: event is triggered if the mouse button is released after the delay time is reached
 * .click: event is triggered  if the mouse button is released before the delay time is reached
 */
Vue.directive('mouse', {
	bind: function(el, binding, a) {
		binding.callback = binding.def.mouse(el, binding);
		el.addEventListener('mousedown', binding.callback);
		el.addEventListener('mouseup', binding.callback);
		el.addEventListener('mouseleave', binding.callback);
	},
	unbind: function(el, binding) {
		el.removeEventListener('mousedown', binding.callback);
		el.removeEventListener('mouseup', binding.callback);
		el.removeEventListener('mouseleave', binding.callback);
	},
	mouse: function(el, binding) {
		let timeReached = false;
		let timer = 0;
		let capturing = false;

		return (evt) => {
			let type = evt.type;

			if (capturing && type === 'mouseleave') {
				clearTimeout(timer);
				timeReached = false;
				capturing = false;
			} else
			if (type === 'mousedown') {
				timeReached = false;
				capturing = true;
				clearTimeout(timer);
				timer = setTimeout(() => {
					timeReached = true;
					if (binding.modifiers.down) {
						binding.value(evt);
					}
				}, +binding.arg || 1000);
			} else
			if (type === 'mouseup' && capturing) {
				clearTimeout(timer);
				if (timeReached && binding.modifiers.up) {
					binding.value(evt);
				}
				if (!timeReached && binding.modifiers.click) {
					binding.value(evt);
				}
				timeReached = false;
				capturing = false;
			}
		};
	}
});

Vue.component('play-sounds', {
	data: function() {
		return {
			soundList: getSounds(),
			playSound: {
				name: '',
				src: '',
				type: 'url'
			}
		}
	},
	methods: {
		play: function(sound) {
			this.playSound = sound;
		}
	},
	watch: {
		soundList: saveSounds
	},
	template: `
<div class="play-sounds">
	<sounds-container :soundList="soundList" @play="play" :playingSound="playSound"></sounds-container>
	<footer class="player-footer">
		<audio-player :sound="playSound"></audio-player>
	</footer>
	<v-notification></v-notification>
</div>
	`
});

Vue.component('v-notification', {
	data: function() {
		return notification;
	},
	computed: {
		displayed: function() {
			if (this.display) {
				clearTimeout(this.timer);
				this.timer = setTimeout(() => this.display = false, this.delay);
			}
			return this.display ? 'display' : 'hide';
		}
	},
	template: `
<aside :class="['notification', status, displayed]" @click="display = false">
	{{message}}
</aside>
	`
});

Vue.component('audio-player', {
	props: {
		'sound': typeSound
	},
	template: `
<audio :src="sound.src" class="player" controls autoplay></source>
</audio>
	`
});

Vue.component('sounds-container', {
	props: ['soundList', 'playingSound'],
	data: () => ({
		displayDialog: false,
		sound: null,
		dragIndex: -1,
		dragOverIndex: -1
	}),
	methods: {
		addSoundBox: function() {
			this.sound = null;
			this.displayDialog = true;
		},
		editSound: function(sound) {
			this.sound = sound;
			this.displayDialog = true;
		},
		playSound: function(sound) {
			this.$emit('play', sound);
		},
		dragstart: function(sound) {
			this.dragIndex = this.soundList.indexOf(sound);
			this.dragOverIndex = this.dragIndex;
		},
		dragover: function(sound) {
			var dragOverIndex = this.soundList.indexOf(sound);

			if (dragOverIndex < 0) {
				dragOverIndex = this.soundList.length;
			}

			this.dragOverIndex = dragOverIndex;
		},
		dragend: function() {
			this.dragOverIndex = -1;
			this.dragIndex = -1;
		},
		dropElement: function(sound) {
			var snd = this.soundList.splice(this.dragIndex, 1);
			var dragOverIndex = this.soundList.indexOf(sound);

			if (dragOverIndex < 0) {
				dragOverIndex = this.soundList.length;
			}

			this.soundList.splice(dragOverIndex, 0, ...snd);
			this.dragOverIndex = this.soundList.indexOf(sound);

			this.dragOverIndex = -1;
			this.dragIndex = -1;
		}
	},
	template: `
<div class="sounds-container">
	<template v-for="(box, index) of soundList">
		<sound-drag
			class="sound-box"
			v-show="dragOverIndex === index"
			:sound="box"
			@drop="dropElement"
		></sound-drag>
		<sound-box
			v-show="dragIndex !== index"
			:key="box.name"
			:sound="box"
			:class="{'sound-box': true, 'sound-playing': box === playingSound}"
			@click="playSound"
			@edit="editSound"
			@dragstart="dragstart"
			@dragover="dragover"
			@drop="dropElement"
			@dragend="dragend"
		></sound-box>
	</template>
	<transition name="fade">
		<sound-drag
			class="sound-box"
			v-if="dragOverIndex === soundList.length"
			@drop="dropElement"
		></sound-drag>
	</transition>
	<add-sound-box
		class="sound-box"
		@click="addSoundBox"
		@dragover="dragover"
		@drop="dropElement"
	></add-sound-box>
	<dialog-add-sound v-if="displayDialog" :soundList="soundList" :sound="sound" @close="displayDialog=false"></dialog-add-sound>
</div>
	`
});

Vue.component('dialog-add-sound', {
	props: {
		'sound': typeSound,
		'soundList': {
			type: Array,
			required: true
		}
	},
	data: function() {
		return {
			name: '',
			src: '',
			type: 'file',
			recording: false
		};
	},
	computed: {
		title: function() {
			if (this.sound) {
				this.name = this.sound.name;
				this.src = this.sound.src;
				this.type = this.sound.type;
			} else {
				this.name = '';
				this.src = '';
				this.type = 'file';
			}
			return this.sound ? 'Edit sounds ' + this.sound.name : 'Add a sound';
		}
	},
	methods: {
		stopRecording: function() {
			this.recording = false;
		},
		cancel: function() {
			this.stopRecording();
			this.$emit('close', this.sound);
		},
		save: function() {
			let action;
			this.stopRecording();
			if (!this.name) {
				notification.show('Add a name to the sound');
				return;
			}
			if (!this.src) {
				notification.show('Choose a source');
				return;
			}

			if (this.sound) {
				action = 'updated';
				this.sound.name = this.name;
				this.sound.src = this.src;
				this.type = this.type;
				saveSounds(this.soundList);
			} else {
				action = 'added';
				this.soundList.push({
					name: this.name,
					src: this.src,
					type: this.type
				});
			}
			this.$emit('close', this.sound);
			notification.show('Sound ' + this.name + ' ' + action, 'success');
		},
		deleteSound: function(sound) {
			var index = this.soundList.indexOf(sound);
			this.soundList.splice(index, 1);
			this.stopRecording();
			this.$emit('close', this.sound);
		},
		onloadfile: function(evt) {
			let file = evt.target.files[0];
			let reader = new FileReader();
			if (!this.name) {
				this.name = file.name;
			}
            reader.onloadend = (data) => {
                this.src = data.target.result;
            };
            reader.readAsDataURL(file);
		},
		onkeypress: function(evt) {
			let key = evt.keyCode;
			switch (key) {
				case 13: this.save(); break;
				case 27: this.cancel(); break;
			}
		}
	},
	template: `
<div class="dialog-mask" @click.self="cancel">
	<div class="dialog" v-keys="onkeypress">
		<header>{{title}}</header>
		<form @submit.prevent>
			<label>Name: <input type="text" v-model="name"></label>
			<label>Source:</label>
			<label><input type="radio" value="file" v-model="type">from file</label>
			<label><input type="radio" value="url" v-model="type">URL of the source</label>
			<label><input type="radio" value="recorded" v-model="type">record</label>
			
			<label v-if="type === 'url'"><input type="url" v-model="src" placeholder="from url"></label>
			<label v-if="type === 'file'"><input type="file" @change="onloadfile"></label>
			<label v-if="type === 'recorded'">TODO</label>
		</form>
		<audio :src="src" controls></audio>
		<footer>
			<button class="btn-cancel" @click.prevent="cancel">Cancel</button>
			<button class="btn-delete" @click.prevent="deleteSound" v-if="this.sound">Delete</button>
			<button class="btn-save" @click.prevent="save">Save</button>
		</footer>
	</div>
</div>
	`
});

var box = Vue.component('sound-box', {
	props: {
		sound: typeSound
	},
	data: function() {
		return {
			edit: false,
			dragging: false
		};
	},
	methods: {
		click: function() {
			this.$emit('click', this.sound);
		},
		edition: function() {
			this.edit = false;
			this.$emit('edit', this.sound);
		},
		editing: function() {
			this.edit = true;
		},
		remove: function() {
			this.$emit('remove', this.sound);
		},
		drop: function(event) {
			this.$emit('drop', this.sound);
		},
		dragover: function(event) {
			this.$emit('dragover', this.sound);
		},
		dragstart: function(event) {
			event.dataTransfer.dropEffect = 'move';
		    event.dataTransfer.effectAllowed = 'move';
		    event.dataTransfer.setData("text", 'coucou');
		    this.dragging = true;
		},
		dragend: function(event) {
			this.$emit('dragend', this.sound);
			this.dragging = false;
		},
		dragleave: function(event) {
			if (this.dragging) {
				this.$emit('dragstart', this.sound);
			}
		}
	},
	template: `
<div :class="{'sound-edit': edit}"
	v-mouse:1000.click="click" v-mouse:1000.up="edition"
	v-mouse:1000.down="editing"
	@mouseleave="edit=false;"

	@dragstart="dragstart"
	@dragend.prevent="dragend"
	@drop.prevent="drop"
	@dragover.prevent="dragover"
	@dragleave.prevent="dragleave"

	draggable="draggable"
>
	<div v-if="edit">Edit ?</div>
	<header>{{sound.name}}</header>
</div>
	`
});

Vue.component('sound-drag', {
	extends: box,
	template: `
<div class="sound-drag"
	@dragover.prevent="dragover"
	@drop.prevent="drop"
>
	<header>Move sound here</header>
</div>
	`
});

Vue.component('add-sound-box', {
	extends: box,
	methods: {
		click: function() {
			this.$emit('click');
		}
	},
	template: `
<div
	@click="click"
	@dragover.prevent="dragover"
	@drop.prevent="drop"
>
	<header class="large-icon">+</header>
</div>
	`
});
