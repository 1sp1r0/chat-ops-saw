var EventEmitter = require('events');
var Client = require('node-rest-client').Client;
var Q = require('q');

function SAW() {
	this.eventEmitter = new EventEmitter();
	this.client = new Client();
};

SAW.prototype.SAW_URL = '';
SAW.prototype.TENANT_ID = '';
SAW.prototype.BASE_URL_INCIDENT = '';
SAW.prototype.TOKEN = '';
SAW.prototype.headers = { 'Content-Type': 'application/json' };
SAW.prototype.DELAY_WATCH_INCIDENT = 1000 * 60 * 5;
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
	that.BASE_URL_INCIDENT = '/rest/' + that.TENANT_ID + '/ems/Incident';

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
	setInterval(function () {
		var layout = ['Id','DisplayLabel'];
		var end = new Date().getTime();
		that.__httpGet(that.BASE_URL_INCIDENT + '?filter=EmsCreationTime+btw+(' + start + ',' + end + ')&layout=' + layout.join(), function (data, res) {
			if (res.statusCode == 200) {
				var newIncidents = data.entities;
				/*
					[{ 
						entity_type: 'Incident',
					    properties: { 
					   		LastUpdateTime: 1459231699278,
					       	Id: '18246',
					       	DisplayLabel: 'ABC' 
					    },
					    related_properties: {} 
					}]
				*/
				if (newIncidents.length > 0) {
					console.log(newIncidents.length + ' Incidents are created');
					that.eventEmitter.emit(that.EVENT_NEW_INCIDENT, newIncidents);
				}
				start = new Date().getTime();
			}
		});
	}, 1000 * 30);
};

SAW.prototype.showIncident = function(IncidentId) {
	var layout = [
		'Id',
		'DisplayLabel'
	];
	var that = this;
	var deferred = Q.defer();
	that.__httpGet(that.BASE_URL_INCIDENT + '/' + IncidentId + '?layout=' + layout.join(), function (data, res) {
		if (res.statusCode == 200) {
			if (data.entities.length > 0) {
				deferred.resolve(data.entities[0]);
			} else {
				deferred.reject('Cannot find Incident: ' + IncidentId);
			}
		} else {
			deferred.reject(res.statusMessage);
		}
	});
	return deferred.promise;
}

SAW.prototype.assignIncident = function(IncidentId, personName) {

}

SAW.prototype.closeIncident = function(IncidentId) {

}

SAW.prototype.onIncidentOccur = function(callback) {
	this.eventEmitter.on(this.EVENT_NEW_INCIDENT, callback);
}

module.exports = new SAW();