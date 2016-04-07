var util = require('util');
var EventEmitter = require('events');
var Client = require('node-rest-client').Client;
var Q = require('q');
var _ = require('underscore');

function SAW() {
	this.eventEmitter = new EventEmitter();
	this.client = new Client();
	this.intervalObject = undefined
	this.sawUrl = '';
	this.tenantId = '';

	this.baseUrlBulk = '';
	this.baseUrlEntity = '';
	this.baseUrlPerson = '';
	this.baseUrlPersonGroup = '';
	this.baseUrlITProcessRecordCategory = '';

	this.TOKEN = '';
	this.LAUNCH_TIME = 0;

	this.cachedEntities = {};
};

SAW.prototype.headers = { 'Content-Type': 'application/json' };
SAW.prototype.DELAY_WATCH_ENTITY = 1000 * 10;
SAW.prototype.EVENT_SAW_NEW_ENTITY = 'SAW_NEW_ENTITY';
SAW.prototype.EVENT_SAW_UPDATE_ENTITY = 'SAW_UPDATE_ENTITY';
SAW.prototype.EVENT_SAW_AUTHORIZED = 'EVENT_SAW_AUTHORIZED';

SAW.prototype.__httpGet = function (path, callback) {
	this.client.get(this.sawUrl + path, { headers: this.headers }, callback);
};

SAW.prototype.__httpPost = function (path, data, callback) {
	this.client.post(this.sawUrl + path, { headers: this.headers, data: data }, callback);
};

SAW.prototype.__splitEntities = function (entities, createdEntities, updatedEntities) {
	var that = this;
	entities.forEach(function (e) {
		if (e.properties.EmsCreationTime >= that.LAUNCH_TIME) {
			var entityId = e.properties.Id;
			if (that.cachedEntities[entityId] !== undefined) {
				console.log('Add entity to updated entity array');
				updatedEntities.push(e);
			} else {
				console.log('Add entity to created entity array');
				createdEntities.push(e);
			}
			that.cachedEntities[entityId] = e;
			console.log('Cached entities after launched: ' + JSON.stringify(that.cachedEntities));
		}
	});
};

SAW.prototype.__getEntity = function (entityId) {
	var that = this;
	var layout = ['Id','DisplayLabel','AssignedGroup.Id','AssignedGroup.Name'];
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(that.baseUrlEntity + util.format('/%s?layout=%s', entityId, layout.join()), function (data, res) {
			if (res.statusCode == 200) {
				if (data.entities.length > 0) {
					resolve(data.entities[0]);
				} else {
					reject('Cannot find entity: ' + entityId);
				}
			} else {
				reject(res.statusMessage);
			}
		});
	});
};

SAW.prototype.__getPersonsByGroup = function (entity) {
	entity['persons'] = [];
	var that = this;
	var layout = ['Id','Name','Email'];
	return Q.Promise(function (resolve, reject, notify) {
		var assignedGroup = entity.related_properties.AssignedGroup;
		if (assignedGroup === undefined) {
			resolve(entity);
		} else {
			that.__httpGet(that.baseUrlPerson + util.format('?filter=(PersonToGroup[Id = %s])&layout=%s', assignedGroup.Id, layout.join()), function (data, res) {
				if (res.statusCode == 200) {
					if (data.entities.length > 0) {
						entity['persons'] = data.entities;
					} else {
						console.log('No persons in group ' + assignedGroup.Name);
					}
				} else {
					console.log(res.statusMessage);
				}
				resolve(entity);
			});
		}
	});
};

SAW.prototype.__createUpdateOperation = function (entityType, entityId, properties) {
	return {
		entities:[{
			entity_type: entityType,
			properties: _.extend({
				Id: entityId
			}, properties)
		}],
		operation: "UPDATE"
	};
};

SAW.prototype.__executeUpdateOperation = function (postBody) {
	var that = this;
	return Q.Promise(function (resolve, reject, notify) {
		console.log(JSON.stringify(postBody));
		that.__httpPost(that.baseUrlBulk, postBody, function (data, res) {
			if (res.statusCode == 200) {
				// data.meta.completion_status === 'OK'
				resolve(data);
			} else {
				reject(res.statusMessage);
			}
		})
	});
};

SAW.prototype.__getPersonByEmail = function (email) {
	var that = this;
	var layout = ['Id','Name','Email'];
	var url = that.baseUrlPerson + util.format("?filter=((IsSystemIntegration != 'true' and IsSystem != 'true') and Email = ('%s'))&layout=%s", email, layout.join());
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(url, function (data, res) {
			if (res.statusCode === 200) {
				if (data.entities.length > 0) {
					resolve(data.entities[0]);
				} else {
					reject('Cannot find person by email: ' + email);
				}
			} else {
				reject(res.statusMessage);
			}
		});
	});
};

SAW.prototype.__getGroupByName = function (name) {
	var that = this;
	var layout = ['Id', 'Name', 'GroupType'];
	var url = that.baseUrlPersonGroup + util.format("?filter=Name = ('%s')&layout=%s", name, layout.join());
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(url, function (data, res) {
			if (res.statusCode === 200) {
				if (data.entities.length > 0) {
					resolve(data.entities[0]);
				} else {
					reject('Cannot find group by name: ' + name);
				}
			} else {
				reject(res.statusMessage);
			}
		});
	});
};

SAW.prototype.__getCategoryByName = function (name) {
	var that = this;
	var layout = ['Id', 'DisplayLabel'];
	var url = that.baseUrlITProcessRecordCategory + util.format("?filter=(IsActive = 'true' and (DisplayLabel startswith ('%s') or Level1Parent startswith ('%s') or Level2Parent startswith ('%s')))&layout=%s", name, name, name, layout.join());
	console.log(url);
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(url, function (data, res) {
			if (res.statusCode === 200) {
				if (data.entities.length > 0) {
					resolve(data.entities[0]);
				} else {
					reject('Cannot find category by name: ' + name);
				}
			} else {
				reject(res.statusMessage);
			}
		});
	});
};

// ----------------------------------------------------------------------------------------------------------------------------------

SAW.prototype.assignPerson = function(entityType, entityId, field, email) {
	var that = this;
	return this.__getPersonByEmail(email).then(function (person) {
		var personId = person.properties.Id;
		var body = {};
		body[field] = personId;
		return that.__executeUpdateOperation(that.__createUpdateOperation(entityType, entityId, body));
	});
};

SAW.prototype.assignGroup = function(entityType, entityId, field, groupName) {
	var that = this;
	return this.__getGroupByName(groupName).then(function (group) {
		var groupId = group.properties.Id;
		var body = {};
		body[field] = groupId;
		return that.__executeUpdateOperation(that.__createUpdateOperation(entityType, entityId, body));
	});
};

SAW.prototype.assignCategory = function (entityType, entityId, categoryName) {
	var that = this;
	return this.__getCategoryByName(categoryName).then(function (category) {
		var categoryId = category.properties.Id;
		var body = {};
		body['Category'] = categoryId;
		return that.__executeUpdateOperation(that.__createUpdateOperation(entityType, entityId, body));
	});
};

SAW.prototype.login = function (url, tenantId, username, password) {
	var that = this;
	that.sawUrl = url;
	that.tenantId = tenantId;
	that.baseUrlEntity = util.format('/rest/%s/ems/Incident', that.tenantId);
	that.baseUrlPerson = util.format('/rest/%s/ems/Person', that.tenantId);
	that.baseUrlPersonGroup = util.format('/rest/%s/ems/PersonGroup', that.tenantId);
	that.baseUrlITProcessRecordCategory = util.format('/rest/%s/ems/ITProcessRecordCategory', that.tenantId);
	that.baseUrlBulk = util.format('/rest/%s/ems/bulk', that.tenantId);

	that.__httpPost('/auth/authentication-endpoint/authenticate/login?TENANTID=' + tenantId, { 'Login': username, 'Password': password }, function (data, res) {
		if (res.statusCode == 200) {
			that.headers['Cookie'] = 'LWSSO_COOKIE_KEY=' + data.toString();
			that.eventEmitter.emit(that.EVENT_SAW_AUTHORIZED);
		} else {
			console.log('Cannot login SAW. Message: ' + res.statusMessage);
		}
	});
};

SAW.prototype.watch = function () {
	var that = this;
	var start = new Date().getTime();
	that.LAUNCH_TIME = start;
	if (this.intervalObject !== undefined) {
		clearInterval(this.intervalObject);
		console.log('Clear interval Object');
	}

	this.intervalObject = setInterval(function () {
		var layout = ['Id','DisplayLabel','EmsCreationTime'];
		var end = new Date().getTime();
		var url = that.baseUrlEntity + '?filter=(EmsCreationTime btw (' + [start, end].join() + ') or LastUpdateTime btw (' + [start, end].join() + '))&layout=' + layout.join();
		that.__httpGet(url, function (data, res) {
			if (res.statusCode == 200) {
				console.log('Search results: ' + JSON.stringify(data));
				var entities = data.entities;
				// [{ 
				//		entity_type: 'Incident',
				//		properties: { 
				//    		LastUpdateTime: 1459231699278,
				//        	Id: '18246',
				//        	DisplayLabel: 'ABC' 
				//		},
				//     	related_properties: {} 
				// }]
				if (entities.length > 0) {
					var createdEntities = [];
					var updatedEntities = [];
					that.__splitEntities(entities, createdEntities, updatedEntities);
					if (createdEntities.length > 0) {
						console.log(createdEntities.length + ' Entities are created in SAW');
						that.eventEmitter.emit(that.EVENT_SAW_NEW_ENTITY, createdEntities);
					}
					if (updatedEntities.length > 0) {
						console.log(updatedEntities.length + ' Entities are updated in SAW');
						that.eventEmitter.emit(that.EVENT_SAW_UPDATE_ENTITY, updatedEntities);
					}
				}
				start = end;
			} else {
				console.log(res.statusMessage);
			}
		});
	}, that.DELAY_WATCH_ENTITY);
};

SAW.prototype.showDetail = function (entityId) {
	return this.__getEntity.bind(this)(entityId).then(this.__getPersonsByGroup.bind(this));
};

SAW.prototype.closeIncident = function(entityId) {

};

SAW.prototype.onEntityCreated = function(callback) {
	this.eventEmitter.on(this.EVENT_SAW_NEW_ENTITY, callback);
};

SAW.prototype.onEntityUpdated = function(callback) {
	this.eventEmitter.on(this.EVENT_SAW_UPDATE_ENTITY, callback);
};

SAW.prototype.onAuthorized = function (callback) {
	this.eventEmitter.on(this.EVENT_SAW_AUTHORIZED, callback);
};

module.exports = new SAW();