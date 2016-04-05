var _ = require('underscore');
var Client = require('node-rest-client').Client;
var Q = require('q');

var rest = new Client({
	proxy: {
		host: "web-proxy.corp.hp.com",
		port: 8080,
		tunnel: true
	}
});

/********************************** slack ***************************************/
var baseURL = 'https://slack.com/api/';
var baseParams = {
	token: 'xoxp-29494174529-29494175089-30161264868-ac52550f20'
};

var consoleLog = _.bind(console.log, console);

function apiURL(baseURL, action,  params) {
	return baseURL + action + '?' + _.map(params,function(value,key) {
		return key + '=' + value;
	}).join('&');

}

function callSlack(action, params) {
	var deferred = Q.defer(),
		params = _.extend(params || {},baseParams);
	rest.get(apiURL(baseURL,action,  params),function(data) {
		deferred.resolve(data);
	});

	return deferred.promise;
}

var allRooms = {};
function createRoom(name) {
	return callSlack('channels.create',{name:name}).then(function(data){
		allRooms[name] = {
			id: data.channel.id,
			name: data.channel.name
		};
	});
}


function inviteMember(roomName,user) {
	var userId;
	if(user.email !== undefined) {
		userId = findUserByEmail(user.email).id;
	}
	if(user.name !== undefined) {
		userId = findUserByName(user.name).id;
	}
	return callSlack('channels.invite',{channel:allRooms[roomName].id, user:userId});
}

function sendMessage(roomName, message, username) {
	return callSlack('chat.postMessage',{channel:allRooms[roomName].id, text:message, username:username,as_user:false});
}


/********************************** users ***************************************/
var allUsers = {};

function getAllUser() {
	return callSlack('users.list');
}

function getUserInfo(userId) {
	return callSlack('users.info',{user:userId});
}


function findUserByEmail(email) {
	return _.first(_.where(_.values(allUsers),{email:email}));
}

function findUserByName(name) {
	return _.first(_.where(_.values(allUsers),{name:name}));
}


/********************************** init ***************************************/
setInterval(function() {
	getAllUser().then(function(data) {
		data.members.forEach(function(user,index) {
			if(allUsers[user.id] === undefined) {
				allUsers[user.id] = {
						id:user.id,
						name:user.name,
						isBot: user.is_bot,
						email: user.profile.email
				};
			}
		});
	});
}, 6 * 1000);

module.exports = {
	createRoom: createRoom,
	inviteMember: inviteMember,
	sendMessage: sendMessage
}