(function() {
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
			var properties = this.options.btapp.get('torrent').get(this.model.get('torrent')).get('properties');
			this.$el.data('uri', properties.get('uri'));
			this.$el.data('torrent', this.model.get('torrent'));
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
		className: 'badge',
		initialize: function() {
			this.count = 0;
			this.model.live('torrent * file *', _.bind(function(file) {
				this.count++;
				this.render();
				file.on('destroy', _.bind(function() {
					this.count--;
					this.render();
				}, this));
			}, this));
			this.model.on('add:torrent', _.bind(function() {
				this.$el.addClass('badge-info');
			}, this));
			this.model.on('remove:torrent', _.bind(function() {
				this.$el.removeClass('badge-info');
			}, this));
		},
		render: function() {
			this.$el.empty();
			if(this.model.has('torrent')) {
				this.$el.text(this.count);
			} else {
				this.$el.text('-');
			}
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
			var angle = (i - 3.75) / 7.5 * Math.PI;
			var x = 255 * Math.cos(angle) + 310;
			var y = 255 * Math.sin(angle) + 310;

			this.$el.css('left', x + 'px');
			this.$el.css('top', y + 'px');

			this.badge = new BadgeView({model: this.model.btapp});

			this.model.on('show', function() {
				this.$el.addClass('selected');
			}, this);
			this.model.on('hide', function() {
				this.$el.removeClass('selected');
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
					var addable = this.model.btapp.has('add');
					var duplicate = this.model.btapp.has('torrent') && this.model.btapp.get('torrent').get(draggable.data('torrent'));
					return addable && !duplicate;
				}, this),
				hoverClass: 'ui-state-hover hover',
				activeClass: 'ui-state-active',
				drop: _.bind(function(event, ui) {
					var draggable = ui.draggable;
					var uri = draggable.data('uri');
					var torrent = draggable.data('torrent');
					console.log(uri);
					console.log(torrent);
					this.model.btapp.get('add').torrent(uri).then(function() {
						console.log('torrent added');
					});
				}, this)
			});
		},
		render: function() {
			this.$el.empty();
			var name = $('<p></p>');
			name.text(this.model.get('label'));
			this.$el.append(name);
			this.$el.append(this.badge.render().el);
			return this;
		}
	});

	Bubble = Backbone.Model.extend({
		initialize: function() {
			if(this.has('btapp')) {
				this.btapp = this.get('btapp');
			} else {
				this.btapp = new Btapp;
				this.btapp.connect(this.get('credentials'));
			}
		}
	});

	Bubbles = Backbone.Collection.extend({
		model: Bubble
	});

	WelcomeNameView = Backbone.View.extend({
		tagName: 'div',
		className: 'welcome_name_frame welcome_frame',
		events: {
			'click .btn-primary': 'click',
			'submit': 'click'
		},
		initialize: function() {
			this.template = _.template($('#welcome_name_template').html());
		},
		render: function() {
			this.$el.html(this.template({}));
			return this;
		},
		click: function(event) {
			event.stopPropagation();
			event.preventDefault();
			var name = this.$('input').val();
			if(name.length > 0) {
				jQuery.jStorage.set('name', name);
				this.remove();
				this.model.trigger('next');
			} else {

			}
		}
	});

	WelcomeInstallView = Backbone.View.extend({
		tagName: 'div',
		className: 'welcome_install_frame welcome_frame',
		initialize: function() {
			this.$el.hide();
			this.template = _.template($('#welcome_install_template').html());
            this.plugin_manager = new PluginManager();
            this.plugin_manager.on('plugin:plugin_installed', _.bind(function() {
            	this.remove();
            	this.model.trigger('next');
            }, this));
            this.plugin_manager.on('plugin:install_plugin', _.bind(function() {
            	this.$el.show();
            }, this));
		},
		render: function() {
			this.$el.html(this.template({
				name: jQuery.jStorage.get('name'),
				url: this.plugin_manager.get('download_url')
			}));
			return this;
		}
	});

	WelcomeExplainationView = Backbone.View.extend({
		tagName: 'div',
		className: 'welcome_explanation_frame welcome_frame',
		events: {
			'click .btn-primary': 'click',
			'submit': 'click'
		},
		initialize: function() {
			this.template = _.template($('#welcome_explaination_template').html());
		},
		render: function() {
			this.$el.html(this.template({
				friend: getArgs()['name'],
				name: jQuery.jStorage.get('name')
			}));
			return this;
		},
		click: function() {
			this.remove();
			this.model.trigger('next');
		}
	});

	function setupRemote(btapp) {
		//make sure that we have credentials available
		if(!jQuery.jStorage.get('username')) {
			jQuery.jStorage.set('username', randomString());
		}
		if(!jQuery.jStorage.get('password')) {
			jQuery.jStorage.set('password', randomString());
		}
		var username = jQuery.jStorage.get('username');
		var password = jQuery.jStorage.get('password');
		when(function() {
				return typeof btapp.connect_remote !== 'undefined' && btapp.has('settings');
			}, function() {
				var connected = btapp.get('settings').get('webui.uconnect_enable') === 'true';
				var matching = btapp.get('settings').get('webui.uconnect_username') === username;
				if(!connected || !matching) {
					console.log('connect_remote(' + username + ',' + password + ')');
					btapp.connect_remote(username, password);
				} else {
					console.log('already connected as ' + username);
				}
			}
		);
	}

	function setupAddBubble(btapp) {
		$('.add_bubble').click(function() {
			if(typeof btapp.browseforfiles === 'undefined') return;
			btapp.browseforfiles(function(files) {
				if(typeof btapp.create === 'undefined') return;
				var files = _(files).values();
				if(files.length == 0) return;
				btapp.create('', files, function() {
					console.log('created');
				}).then(function() { console.log('called create')}); 
			}).then(function() { console.log('called browseforfiles')});
		});
	}

	function displayWelcome(callback) {
		var namemodel = new Backbone.Model;
		var installmodel = new Backbone.Model;
		var explainationmodel = new Backbone.Model;

		var welcomenameview = new WelcomeNameView({model: namemodel});
		$('body').append(welcomenameview.render().el);

		var show_install = function() {
			var welcomeinstallview = new WelcomeInstallView({model: installmodel});
			$('body').append(welcomeinstallview.render().el);
		};
		var show_explaination = function() {
			var welcomeexplainationview = new WelcomeExplainationView({model: explainationmodel});
			$('body').append(welcomeexplainationview.render().el);
		};

		namemodel.on('next', show_install);
		installmodel.on('next', show_explaination);
		explainationmodel.on('next', callback);
	}

	function addDefaultBubble(bubbles, name) {
		var bubble = new Bubble({
			btapp: new Backbone.Model({
				torrent: new Backbone.Collection([
					new Backbone.Model({
						id: '2110c7b4fa045f62d33dd0e01dd6f5bc15902179',
						file: new Backbone.Collection([
							new Backbone.Model({
								id: 'Counting%20Crows%20-%20Underwater%20Sunshine%20-%20Liner%20Notes.pdf',
								torrent: '2110c7b4fa045f62d33dd0e01dd6f5bc15902179',
								properties: new Backbone.Model({
									name: 'Counting Crows - Photos - The Band - 1.jpg',
									size: 181281
								})
							}),
						]),
						properties: new Backbone.Model({
							uri: 'http://featuredcontent.utorrent.com/torrents/CountingCrows-BitTorrent.torrent',
							added_on: new Date()
						})
					})
				])
			}),
			label: name,
			position: bubbles.length
		});
		bubbles.add(bubble);
		bubble.trigger('hide');
	}

	jQuery(function() {
		$('.social_bubble, .add_user, .add_bubble, .bubble_container, .navbar, .banner').hide();

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

		//twitter
		(function() {
			var link = 'http://paddleover.com?name=pwmckenna&cu=' + jQuery.jStorage.get('username') + '&cp=' + jQuery.jStorage.get('password');
			var text = 'Drag files from my computer to yours, and visa versa using #PaddleOver.'
			$('.twitter_bubble').attr('href', 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(link) + '&text=' + text);
		}());

		$('.fb_bubble').click(function() {
			var link = 'http://paddleover.com?name=pwmckenna&cu=' + jQuery.jStorage.get('username') + '&cp=' + jQuery.jStorage.get('password');
			var text = 'Drag files from my computer to yours, and visa versa.'
			var description = 'Let friends add files to your computer, and do the same for them. Works both ways too, so you can take what you want!';
			FB.init({appId: '353964634659536', xfbml: true, cookie: true});
			FB.ui({
				method: 'send',
				picture: 'http://paddleover.com/images/icon.png',
				description: description,
				name: text,
				link: link
			});
		});

		function start() {
			var self = new Bubble({
				credentials: {},
				label: jQuery.jStorage.get('name'),
				position: 0
			});
			setupRemote(self.btapp);
			bubbles.add(self);
			self.trigger('show');
			$('.social_bubble, .add_user, .add_bubble, .bubble_container, .navbar, .banner').show();
			setupAddBubble(self.btapp);

			addDefaultBubble(bubbles, '80 Proof');
			addDefaultBubble(bubbles, 'Counting Crows');
			addDefaultBubble(bubbles, 'Pretty Lights')

			//add the friend if there was one provided as url args
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
			}

			jQuery.jStorage.set('welcomed', true);
		}

		if(jQuery.jStorage.get('welcomed') === true) {
			start();
		} else {
			displayWelcome(start);
		}
		$('.auto-focus:first').focus();
	});
}).call(this);