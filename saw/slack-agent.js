var _ = require('underscore');
var Client = require('node-rest-client').Client;
var Q = require('q');

var rest = new Client();

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


function createRoom(name,incidentId) {
	return callSlack('channels.create',{name:name}).then(function(data){
		var room = {
			id: data.channel.id,
			name: data.channel.name,
			incidentId:incidentId
		};
		allRooms[data.channel.id] = room;
		return room;
	});
}

function getAllUser() {
	return callSlack('users.list');
}

function getUserInfo(userId) {
	return callSlack('users.info',{user:userId});
}

function inviteMember(channelId,userId) {
	return callSlack('channels.invite',{channel:channelId, user:userId});
}

function sendMessage(channelId, message, username) {
	return callSlack('chat.postMessage',{channel:channelId, text:message, username:username,as_user:false});
}


/********************************** users ***************************************/
var allUsers = {};

function listUsers() {
	return allUsers;
}

function findUserByEmail(email) {
	return _.first(_.map(allUsers,function(user){
		return user;
	}).filter(function(user) {
		return user.email === email;
	}));
}

function findUserByName(name) {
	return _.first(_.map(allUsers,function(user){
		return user;
	}).filter(function(user) {
		return user.username === name;
	}));
}

/********************************** rooms ***************************************/
var allRooms = {};

function listRooms() {
	return allRooms;
}

/********************************** init ***************************************/
setInterval(function() {
	getAllUser().then(function(data) {
		data.members.forEach(function(user) {
			if(allUsers[user.id] === undefined) {
				getUserInfo(user.id).then(function(result){
					allUsers[user.id] = {
						slackId:user.id,
						username:user.name,
						isBot: user.is_bot,
						email: result.user.profile.email
					};
				});
			}
		});
	});
}, 6 * 1000);



module.exports = {
	createRoom: createRoom,
	inviteMember: inviteMember,
	sendMessage: sendMessage,
	listRooms: listRooms,
	listUsers: listUsers,
	findUserByEmail: findUserByEmail,
	findUserByName:findUserByName
}