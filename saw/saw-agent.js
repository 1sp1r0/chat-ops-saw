var util = require('util');
var EventEmitter = require('events');
var Client = require('node-rest-client').Client;
var Q = require('q');
var _ = require('underscore');

function SAW() {
	this.eventEmitter = new EventEmitter();
	this.client = new Client();
	this.sawUrl = '';
	this.tenantId = '';
	this.baseUrlEntities = {
		Incident: ''
	};
	this.baseUrlBulk = '';
	this.baseUrlPerson = '';
	this.baseUrlPersonGroup = '';
	this.baseUrlITProcessRecordCategory = '';
};

SAW.prototype.headers = { 'Content-Type': 'application/json' };

SAW.prototype.__httpGet = function (path, callback) {
	this.client.get(this.sawUrl + path, { headers: this.headers }, callback);
};

SAW.prototype.__httpPost = function (path, data, callback) {
	this.client.post(this.sawUrl + path, { headers: this.headers, data: data }, callback);
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

SAW.prototype.getEntity = function (entityType, entityId) {
	var that = this;
	var layout = ['Id','DisplayLabel'];
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(that.baseUrlEntities[entityType] + util.format('/%s?layout=%s', entityId, layout.join()), function (data, res) {
			if (res.statusCode == 200) {
				if (data.entities.length > 0) {
					resolve(data.entities);
				} else {
					reject('Cannot find entity: ' + entityId);
				}
			} else {
				reject(res.statusMessage);
			}
		});
	});
};

SAW.prototype.getPersonsByGroupId = function (groupId) {
	var that = this;
	var layout = ['Id','Name','Email'];
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(that.baseUrlPerson + util.format('?filter=(PersonToGroup[Id = %s])&layout=%s', groupId, layout.join()), function (data, res) {
			if (res.statusCode == 200) {
				if (data.entities.length > 0) {
					resolve(data.entities);
				} else {
					reject('No person in group: ' + groupId);
				}
			} else {
				reject(res.statusMessage);
			}
		});
	});
};

SAW.prototype.getPersonByEmail = function (email) {
	var that = this;
	var layout = ['Id','Name','Email'];
	var url = that.baseUrlPerson + util.format("?filter=((IsSystemIntegration != 'true' and IsSystem != 'true') and Email = ('%s'))&layout=%s", email, layout.join());
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(url, function (data, res) {
			if (res.statusCode === 200) {
				if (data.entities.length > 0) {
					resolve(data.entities);
				} else {
					reject('Cannot find person by email: ' + email);
				}
			} else {
				reject(res.statusMessage);
			}
		});
	});
};

SAW.prototype.getGroupByName = function (name) {
	var that = this;
	var layout = ['Id', 'Name', 'GroupType'];
	var url = that.baseUrlPersonGroup + util.format("?filter=Name = ('%s')&layout=%s", name, layout.join());
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(url, function (data, res) {
			if (res.statusCode === 200) {
				if (data.entities.length > 0) {
					resolve(data.entities);
				} else {
					reject('Cannot find group by name: ' + name);
				}
			} else {
				reject(res.statusMessage);
			}
		});
	});
};

SAW.prototype.updateField = function (entityType, entityId, properties) {
	return this.__executeUpdateOperation(this.__createUpdateOperation(entityType, entityId, properties));
};

SAW.prototype.assignPersonByEmail = function(entityType, entityId, field, email) {
	var that = this;
	return this.getPersonByEmail(email).then(function (persons) {
		return Q.Promise(function (resolve, reject, notify) {
			if (persons.length === 1) {
				resolve(persons[0]);
			} else {
				reject(util.format('%d persons are found', persons.length));
			}
		}).then(function (person) {
			var personId = person.properties.Id;
			var property = {};
			property[field] = personId;
			return  that.updateField(entityType, entityId, property);
		});
	});
};

SAW.prototype.assignGroupByGroupName = function(entityType, entityId, field, groupName) {
	var that = this;
	return this.getGroupByName(groupName).then(function (groups) {
		return Q.Promise(function (resolve, reject, notify) {
			if (groups.length === 1) {
				resolve(groups[0]);
			} else {
				reject(util.format('%d groups are found', groups.length));
			}
		}).then(function (group) {
			var groupId = group.properties.Id;
			var property = {};
			property[field] = groupId;
			return  that.updateField(entityType, entityId, property);
		});
	});
};

SAW.prototype.getCategoryByName = function (name) {
	var that = this;
	var layout = ['Id', 'DisplayLabel'];
	var url = that.baseUrlITProcessRecordCategory + util.format("?filter=(IsActive = 'true' and (DisplayLabel startswith ('%s') or Level1Parent startswith ('%s') or Level2Parent startswith ('%s')))&layout=%s", name, name, name, layout.join());
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(url, function (data, res) {
			if (res.statusCode === 200) {
				if (data.entities.length > 0) {
					resolve(data.entities);
				} else {
					reject('Cannot find category by name: ' + name);
				}
			} else {
				reject(res.statusMessage);
			}
		});
	});
};

SAW.prototype.assignCategory = function (entityType, entityId, categoryName) {
	var that = this;
	return this.__getCategoryByName(categoryName).then(function (category) {
		var categoryId = category.properties.Id;
		var property = {};
		property['Category'] = categoryId;
		return that.updateField(entityType, entityId, property);
	});
};

SAW.prototype.login = function (url, tenantId, username, password) {
	var that = this;
	that.sawUrl = url;
	that.tenantId = tenantId;
	that.baseUrlBulk = util.format('/rest/%s/ems/bulk', that.tenantId);

	_.each(that.baseUrlEntities, function (v, k, o) {
		o[k] = util.format('/rest/%s/ems/%s', that.tenantId, k);
	});

	that.baseUrlPerson = util.format('/rest/%s/ems/Person', that.tenantId);
	that.baseUrlPersonGroup = util.format('/rest/%s/ems/PersonGroup', that.tenantId);
	that.baseUrlITProcessRecordCategory = util.format('/rest/%s/ems/ITProcessRecordCategory', that.tenantId);
	

	that.__httpPost('/auth/authentication-endpoint/authenticate/login?TENANTID=' + tenantId, { 'Login': username, 'Password': password }, function (data, res) {
		if (res.statusCode == 200) {
			that.headers['Cookie'] = 'LWSSO_COOKIE_KEY=' + data.toString();
			that.eventEmitter.emit(that.EVENT_SAW_AUTHORIZED);
		} else {
			console.log('Cannot login SAW. Message: ' + res.statusMessage);
		}
	});
};

// SAW.prototype.showDetail = function (entityId) {
// 	return this.getEntity.bind(this)(entityId).then(this.__getPersonsByGroup.bind(this));
// };

SAW.prototype.onAuthorized = function (callback) {
	this.eventEmitter.on(this.EVENT_SAW_AUTHORIZED, callback);
};

module.exports = new SAW();