(function() {
	function trackEvent(event, arg) {
		//do something here in the future
	}

    //utility function to wait for some condition
    //this ends up being helpful as we toggle between a flow chart and a state diagram
    function when(condition, functionality) {
        var when_func = function() {
            if(condition.call()) {
                functionality.call();
            } else {
                setTimeout(when_func, 500);
            }
        };
        _.defer(when_func);
    }

	function randomString() {
		var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
		var string_length = 0x10;
		var randomstring = '';
		for (var i=0; i<string_length; i++) {
			var rnum = Math.floor(Math.random() * chars.length);
			randomstring += chars.substring(rnum,rnum+1);
		}
		return randomstring;
	}

	function roundNumber(num, dec) {
		return Math.round(num*Math.pow(10,dec))/Math.pow(10,dec);
	} 

	function humaneSize(fs) {
		if (fs >= 1073741824) { return roundNumber(fs / 1073741824, 2) + ' GB'; }
		if (fs >= 1048576)    { return roundNumber(fs / 1048576, 2) + ' MB'; }
		if (fs >= 1024)       { return roundNumber(fs / 1024, 0) + ' KB'; }
		return fs + ' B';
	}; 


	function getArgs() {
		var searchString = document.location.search;

		// strip off the leading '?'
		searchString = searchString.substring(1);

		var nvPairs = searchString.split("&");
		var ret = {};
		for (i = 0; i < nvPairs.length; i++)
		{
		     var nvPair = nvPairs[i].split("=");
		     ret[nvPair[0]] = nvPair[1];
		}
		return ret;
	}

	FileView = Backbone.View.extend({
		tagName: 'div',
		className: 'file',
		initialize: function() {
			this.model.on('change', this.render, this);
			this.model.on('destroy', this.remove, this);
			this.template = _.template($('#file_template').html());
		},
		render: function() {
			var date = new Date(this.options.btapp.get('torrent').get(this.model.get('torrent')).get('properties').get('added_on') * 1000);
			var name = this.model.get('properties').get('name').replace(/^.*[\\\/]/, '');
			var progress = 100.0 * 
				this.model.get('properties').get('downloaded') / 
				this.model.get('properties').get('size');
			this.$el.html(this.template({
				name: name,
				progress: progress,
				file_size: humaneSize(this.model.get('properties').get('size')),
				file_date: humaneDate(date)
			}));
			this.$el.draggable({
				revert: 'invalid',
				appendTo: 'body',
				helper: 'clone'
			});
			this.$el.droppable();
			return this;
		}
	});

	BubbleContentsView = Backbone.View.extend({
		tagName: 'div',
		className: 'contents',
		initialize: function() {
			this.model.on('change', this.render, this);
			this.model.on('destroy', this.remove, this);
			this.model.on('show', function() {
				this.$el.show();
			}, this);
			this.model.on('hide', function() {
				this.$el.hide();
			}, this);
			
			this.model.btapp.live('torrent * file *', function(file) {
				var view = new FileView({
					model: file,
				 	btapp: this.model.btapp
				 });
				this.$el.append(view.render().el);
			}, this);
		}
	});

	BadgeView = Backbone.View.extend({
		tagName: 'span',
		className: 'badge badge-info',
		initialize: function() {
			this.count = this.model.length;
			this.model.on('add', function() {
				this.count++;
				this.render();
			}, this);
			this.model.on('remove', function() {
				this.count--;
				this.render();
			}, this);
			this.model.on('destroy', this.remove, this);
		},
		render: function() {
			this.$el.empty();
			this.$el.text(this.count);
			return this;
		}		
	});

	BubbleView = Backbone.View.extend({
		tagName: 'div',
		className: 'bubble user_bubble',
		initialize: function() {
			this.model.on('change', this.render, this);
			this.model.on('destroy', this.remove, this);

			var i = this.model.get('position');
			//size relationshipt of the container and the bubbles
			//r = radius of each bubble
			//R = radius of the container
			//r = (R * pi) / (16 + pi)
			var angle = (i - 4) / 8.0 * Math.PI;
			var x = 250 * Math.cos(angle) + 300;
			var y = 250 * Math.sin(angle) + 300;

			this.$el.css('left', x + 'px');
			this.$el.css('top', y + 'px');

			this.model.btapp.on('add:torrent', function(torrents) {
				var badge = new BadgeView({model: torrents});
				this.$el.append(badge.render().el);
			}, this);

			this.$el.click(_.bind(function() {
				this.model.collection.each(function(model) {
					if(this.model !== model) {
						model.trigger('hide');
					}
				}, this);
				this.model.trigger('show');
			}, this));

			this.$el.droppable({
				tolerance: 'pointer',
				greedy: 'true',
				accept: _.bind(function(draggable) {
					return this.model.btapp.has('add');
				}, this),
				hoverClass: 'ui-state-hover',
				activeClass: 'ui-state-active'
			});
		},
		render: function() {
			this.$el.empty();
			this.$el.append(this.model.get('label'));
			return this;
		}
	});

	Bubble = Backbone.Model.extend({
		initialize: function() {
			this.btapp = new Btapp;
			this.btapp.connect(this.get('credentials'));
		}
	});

	Bubbles = Backbone.Collection.extend({
		model: Bubble
	});

	jQuery(function() {
		debugger;
		var bubbles = new Bubbles;
		bubbles.on('add', function(bubble) {
			var view = new BubbleView({model: bubble});
			$('.bubble_container').append(view.render().el);

			var contents = new BubbleContentsView({model: bubble});
			contents.$el.hide();
			$('.bubble_center').append(contents.render().el);
		});

		$('.add_user').click(function() {
			var bubble = new Bubble({
				credentials: {
					username: jQuery.jStorage.get('username'),
					password: jQuery.jStorage.get('password')
				},
				label: 'Me_' + bubbles.length,
				position: bubbles.length
			});
			bubbles.add(bubble);
			bubble.trigger('hide');
		});

		var self = new Bubble({
			credentials: {},
			label: 'Me',
			position: 0
		});
		bubbles.add(self);
		self.trigger('show');

		$('.add_bubble').click(function() {
			if(typeof self.btapp.browseforfiles === 'undefined') return;
			self.btapp.browseforfiles(function(files) {
				if(typeof self.btapp.create === 'undefined') return;
				self.btapp.create('', _(files).values(), function() {
					console.log('created');
				}).then(function() { console.log('called create')}); 
			}).then(function() { console.log('called browseforfiles')});
		});

		when(function() {
				return typeof self.btapp.connect_remote !== 'undefined';
			}, function() {
				console.log('setting up account information');
				jQuery.jStorage.set('username', randomString());
				jQuery.jStorage.set('password', randomString());

				console.log('logging in: ' + 
					jQuery.jStorage.get('username') + 
					',' + 
					jQuery.jStorage.get('password')
				);

				self.btapp.connect_remote(jQuery.jStorage.get('username'), jQuery.jStorage.get('password'));
			}
		);

		var args = getArgs();
		if('name' in args && 'cu' in args && 'cp' in args) {
			var friend = new Bubble({
				credentials: {
					username: args.cu,
					password: args.cp
				},
				label: args.name,
				position: bubbles.length
			});
			bubbles.add(friend);
		} else if(!jQuery.isEmptyObject(args)) {
			//this is an event. track it...how are we screwing these urls up
			trackEvent('malformed url', JSON.stringify(args));
		}
	});
}).call(this);