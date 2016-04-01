var util = require('util');
var EventEmitter = require('events');
var Client = require('node-rest-client').Client;
var Q = require('q');

function SAW() {
	this.eventEmitter = new EventEmitter();
	this.client = new Client();
	this.intervalObject = undefined
};

SAW.prototype.SAW_URL = '';
SAW.prototype.TENANT_ID = '';

SAW.prototype.BASE_URL_INCIDENT = '';
SAW.prototype.BASE_URL_PERSON = '';

SAW.prototype.TOKEN = '';
SAW.prototype.headers = { 'Content-Type': 'application/json' };
SAW.prototype.DELAY_WATCH_INCIDENT = 1000 * 10;
SAW.prototype.EVENT_NEW_INCIDENT = 'NEW_INCIDENT';

SAW.prototype.__httpGet = function (path, callback) {
	this.client.get(this.SAW_URL + path, { headers: this.headers }, callback);
};

SAW.prototype.__httpPost = function (path, data, callback) {
	this.client.post(this.SAW_URL + path, { headers: this.headers, data: data }, callback);
};

SAW.prototype.login = function (url, tenantId, username, password) {
	var that = this;
	that.SAW_URL = url;
	that.TENANT_ID = tenantId;
	that.BASE_URL_INCIDENT = util.format('/rest/%s/ems/Incident', that.TENANT_ID);
	that.BASE_URL_PERSON = util.format('/rest/%s/ems/Person', that.TENANT_ID);

	that.__httpPost('/auth/authentication-endpoint/authenticate/login?TENANTID=' + tenantId, { 'Login': username, 'Password': password }, function (data, res) {
		if (res.statusCode == 200) {
			that.headers['Cookie'] = 'LWSSO_COOKIE_KEY=' + data.toString();
		} else {
			console.log('Cannot login SAW. Message: ' + res.statusMessage);
		}
	});
}

SAW.prototype.watchIncident = function () {
	var that = this;
	var start = new Date().getTime();

	if (this.intervalObject !== undefined) {
		clearInterval(this.intervalObject);
		console.log('Clear interval Object');
	}

	this.intervalObject = setInterval(function () {
		var layout = ['Id','DisplayLabel'];
		var end = new Date().getTime();
		that.__httpGet(that.BASE_URL_INCIDENT + '?filter=EmsCreationTime+btw+(' + [start, end].join() + ')&layout=' + layout.join(), function (data, res) {
			if (res.statusCode == 200) {
				var newIncidents = data.entities;
				// [{ 
				//		entity_type: 'Incident',
				//		properties: { 
				//    		LastUpdateTime: 1459231699278,
				//        	Id: '18246',
				//        	DisplayLabel: 'ABC' 
				//		},
				//     	related_properties: {} 
				// }]
				if (newIncidents.length > 0) {
					console.log(newIncidents.length + ' Incidents are created');
					that.eventEmitter.emit(that.EVENT_NEW_INCIDENT, newIncidents);
				}
				start = end;
			}
		});
	}, that.DELAY_WATCH_INCIDENT);
};

SAW.prototype.__getIncident = function (incidentId) {
	var that = this;
	var layout = ['Id','DisplayLabel','AssignedGroup.Id','AssignedGroup.Name'];
	return Q.Promise(function (resolve, reject, notify) {
		that.__httpGet(that.BASE_URL_INCIDENT + '/' + incidentId + '?layout=' + layout.join(), function (data, res) {
			if (res.statusCode == 200) {
				if (data.entities.length > 0) {
					resolve(data.entities[0]);
				} else {
					reject('Cannot find Incident: ' + incidentId);
				}
			} else {
				reject(res.statusMessage);
			}
		});
	});
};

SAW.prototype.__getPersonsFromGroup = function (incident) {
	incident['persons'] = [];
	var that = this;
	var layout = ['Id','Name','Email'];
	return Q.Promise(function (resolve, reject, notify) {
		var assignedGroup = incident.related_properties.AssignedGroup;
		if (assignedGroup === undefined) {
			resolve(incident);
		} else {
			that.__httpGet(that.BASE_URL_PERSON + '?filter=(PersonToGroup[Id = ' + assignedGroup.Id + '])&layout=' + layout.join(), function (data, res) {
				if (res.statusCode == 200) {
					if (data.entities.length > 0) {
						incident['persons'] = data.entities;
					} else {
						console.log('No persons in group ' + assignedGroup.Name);
					}
				} else {
					console.log(res.statusMessage);
				}
				resolve(incident);
			});
		}
	});
};

SAW.prototype.showIncident = function (incidentId) {
	return this.__getIncident.bind(this)(incidentId).then(this.__getPersonsFromGroup.bind(this));
};

SAW.prototype.assignIncident = function(incidentId, personId) {

};

SAW.prototype.closeIncident = function(incidentId) {

};

SAW.prototype.onIncidentOccur = function(callback) {
	this.eventEmitter.on(this.EVENT_NEW_INCIDENT, callback);
};

module.exports = new SAW();