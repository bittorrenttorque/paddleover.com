(function() {
	FileView = Backbone.View.extend({
		tagName: 'div',
		className: 'file',
		initialize: function() {
			this.model.on('change', this.render, this);
			this.model.on('destroy', this.remove, this);
		},
		render: function() {
			this.$el.empty();
			this.$el.append(this.model.get('name'));
			this.$el.append(100.0 * this.model.get('downloaded') / this.model.get('size'));
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
			
			this.model.btapp.live('torrent * file * properties', function(file) {
				var view = new FileView({model:file});
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
	})

	jQuery(function() {
		var bubbles = new Bubbles;
		bubbles.on('add', function(bubble) {
			var view = new BubbleView({model: bubble});
			$('.bubble_container').append(view.render().el);

			var contents = new BubbleContentsView({model: bubble});
			contents.$el.hide();
			$('.bubble_center').append(contents.render().el);
		});

		$('.add_user').click(function() {
			bubbles.add({
				credentials: {},
				label: 'Self_' + bubbles.length,
				position: bubbles.length
			});
		});

		var self = new Bubble({
			credentials: {},
			label: 'Self',
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
				}).then(function() { console.log('called create'); 
			});
		}).then(function() { console.log('called browseforfiles')});
});
	});
}).call(this);