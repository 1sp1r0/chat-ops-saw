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

SAW.prototype.__defaultGetResponseHandler = function (data, res, emptyMessage, resolve, reject, notify) {
	if (res.statusCode == 200) {
		if (data.entities.length > 0) {
			resolve(data.entities);
		} else {
			reject(emptyMessage);
		}
	} else {
		reject(res.statusMessage);
	}
};

SAW.prototype.__defaultAssignExecutor = function (entityType, entityId, field, results, rejectMessage) {
	var that = this;
	return Q.Promise(function (resolve, reject, notify) {
		if (results.length === 1) {
			resolve(results[0]);
		} else {
			reject(rejectMessage);
		}
	}).then(function (result) {
		var resultId = result.properties.Id;
		var property = {};
		property[field] = resultId;
		return  that.updateField(entityType, entityId, property);
	});
};

SAW.prototype.getEntity = function (entityType, entityId) {
	var that = this;
	var layout = ['Id','DisplayLabel'];
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(that.baseUrlEntities[entityType] + util.format('/%s?layout=%s', entityId, layout.join()), function (data, res) {
			that.__defaultGetResponseHandler(data, res, 'Cannot find entity: ' + entityId, resolve, reject, notify);
		});
	});
};

SAW.prototype.getPersonsByGroupId = function (groupId) {
	var that = this;
	var layout = ['Id','Name','Email'];
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(that.baseUrlPerson + util.format('?filter=(PersonToGroup[Id = %s])&layout=%s', groupId, layout.join()), function (data, res) {
			that.__defaultGetResponseHandler(data, res, 'No person in group: ' + groupId, resolve, reject, notify);
		});
	});
};

SAW.prototype.getPersonByEmail = function (email) {
	var that = this;
	var layout = ['Id','Name','Email'];
	var url = that.baseUrlPerson + util.format("?filter=((IsSystemIntegration != 'true' and IsSystem != 'true') and Email = ('%s'))&layout=%s", email, layout.join());
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(url, function (data, res) {
			that.__defaultGetResponseHandler(data, res, 'Cannot find person by email: ' + email, resolve, reject, notify);
		});
	});
};

SAW.prototype.getGroupByName = function (name) {
	var that = this;
	var layout = ['Id', 'Name', 'GroupType'];
	var url = that.baseUrlPersonGroup + util.format("?filter=Name = ('%s')&layout=%s", name, layout.join());
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(url, function (data, res) {
			that.__defaultGetResponseHandler(data, res, 'Cannot find group by name: ' + name, resolve, reject, notify);
		});
	});
};

SAW.prototype.getCategoryByName = function (name) {
	var that = this;
	var layout = ['Id', 'DisplayLabel'];
	var url = that.baseUrlITProcessRecordCategory + util.format("?filter=(IsActive = 'true' and DisplayLabel = ('%s'))&layout=%s", name, layout.join());
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(url, function (data, res) {
			that.__defaultGetResponseHandler(data, res, 'Cannot find category by name: ' + name, resolve, reject, notify);
		});
	});
};

SAW.prototype.updateField = function (entityType, entityId, properties) {
	return this.__executeUpdateOperation(this.__createUpdateOperation(entityType, entityId, properties));
};

SAW.prototype.assignPersonByEmail = function(entityType, entityId, field, email) {
	var that = this;
	return this.getPersonByEmail(email).then(function (results) {
		return that.__defaultAssignExecutor(entityType, entityId, field, results, util.format('%d persons are found', results.length));
	});
};

SAW.prototype.assignGroupByGroupName = function(entityType, entityId, field, groupName) {
	var that = this;
	return this.getGroupByName(groupName).then(function (results) {
		return that.__defaultAssignExecutor(entityType, entityId, field, results, util.format('%d groups are found', results.length));
	});
};

SAW.prototype.assignCategoryByCategoryName = function (entityType, entityId, field, categoryName) {
	var that = this;
	return this.getCategoryByName(categoryName).then(function (results) {
		return that.__defaultAssignExecutor(entityType, entityId, field, results, util.format('%d categories are found', results.length));
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

SAW.prototype.onAuthorized = function (callback) {
	this.eventEmitter.on(this.EVENT_SAW_AUTHORIZED, callback);
};

module.exports = new SAW();