// Lumen's media service (Node, webOS JS service; Node 16 on webOS 24). It starts a title in the Jellyfin app: the page cannot, because once
// Jellyfin is in front the TV stops Lumen's timers, and a play command sent while the app is still loading is dropped. So the page hands the
// job over here, then opens Jellyfin; this waits for the app's session, sends the command until the server reports the title playing, and
// if it never does, shows a message inside Jellyfin. docs/research/films-series-spikes.md has the findings. The service id is
// <app id>.media, written at packaging time (app/scripts/package.sh).
var Service = require('webos-service');
var http = require('http');
var https = require('https');
var NAME = require('./package.json').name;
var service = new Service(NAME);

var BASE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;
var HEX32 = /^[a-f0-9]{32}$/;
var APP_CLIENT = 'Jellyfin for WebOS';
var TV_DEVICE = 'LG Smart TV';
var LOOK_EVERY_MS = 500;
var LOOK_FOR_MS = 20000;
/** the app keeps the same session from one launch to the next, so the most recent one is taken at once; a command it drops while it is
 *  still loading is sent again (SENDS times, CHECK_AFTER_MS apart) */
var CHECK_AFTER_MS = 2000;
var SENDS = 8;
var STOP_SETTLE_MS = 1500;
var STOP_MAX_MS = 5000;
var TIMEOUT_MS = 8000;

function request (job, method, path, body, callback) {
	var called = false;
	var done = function (err, value) { if (!called) { called = true; callback(err, value); } };
	var url = new URL(job.url + path);
	var lib = url.protocol === 'https:' ? https : http;
	var data = body ? JSON.stringify(body) : null;
	var headers = {Authorization: 'MediaBrowser Client="Lumen", Device="LG TV", DeviceId="' + job.deviceId + '", Version="2.0", Token="' + job.token + '"'};
	if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
	var req = lib.request(url, {method: method, headers: headers, timeout: TIMEOUT_MS}, function (res) {
		var text = '';
		res.on('error', function (e) { done(e); });
		res.on('data', function (c) { text += c; });
		res.on('end', function () {
			if (res.statusCode >= 300) { done(new Error('HTTP ' + res.statusCode)); return; }
			try { done(null, text ? JSON.parse(text) : null); } catch (e) { done(e); }
		});
	});
	req.on('timeout', function () { req.destroy(new Error('timeout')); });
	req.on('error', function (e) { done(e); });
	if (data) req.write(data);
	req.end();
}

function tvSessions (job, done) {
	request(job, 'GET', '/Sessions', null, function (err, list) {
		done(err ? [] : (list || []).filter(function (x) { return x.DeviceName === TV_DEVICE; }));
	});
}

function findSession (job, started, done) {
	if (stale(job)) { done(null); return; }
	tvSessions(job, function (list) {
		var ours = list.filter(function (x) { return x.Client === APP_CLIENT; })
			.map(function (x) { return {id: x.Id, at: Date.parse(x.LastActivityDate || '') || 0}; })
			.sort(function (a, b) { return b.at - a.at; })[0];
		if (ours) { done(ours.id); return; }
		if (Date.now() - started > LOOK_FOR_MS) { done(null); return; }
		setTimeout(function () { findSession(job, started, done); }, LOOK_EVERY_MS);
	});
}

function sendUntilPlaying (job, sessionId, left, done) {
	if (stale(job)) { done('replaced'); return; }
	var path = '/Sessions/' + sessionId + '/Playing?playCommand=PlayNow&itemIds=' + job.itemId + '&startPositionTicks=' + job.ticks;
	request(job, 'POST', path, null, function () {
		setTimeout(function () {
			tvSessions(job, function (list) {
				var playing = list.some(function (x) { return x.NowPlayingItem && x.NowPlayingItem.Id === job.itemId; });
				if (stale(job)) done('replaced');
				else if (playing) done('playing');
				else if (left > 1) sendUntilPlaying(job, sessionId, left - 1, done);
				else done('failed');
			});
		}, CHECK_AFTER_MS);
	});
}

/** A title playing in Jellyfin when another is sent to it keeps its sound but loses its picture (seen on webOS 24), and so does one sent
 *  too soon after a stop (1.2 s was too soon, seen 2026-10-29). So: stop it, wait until the server reports nothing playing on the TV, then
 *  give the app STOP_SETTLE_MS more (at most STOP_MAX_MS in all). */
function stopFirst (job, sessionId, done) {
	tvSessions(job, function (list) {
		if (!list.some(function (x) { return !!x.NowPlayingItem; })) { done(); return; }
		var started = Date.now();
		request(job, 'POST', '/Sessions/' + sessionId + '/Playing/Stop', null, function () {
			var settle = function () {
				tvSessions(job, function (now) {
					var playing = now.some(function (x) { return !!x.NowPlayingItem; });
					if (!playing || Date.now() - started > STOP_MAX_MS) setTimeout(done, STOP_SETTLE_MS);
					else setTimeout(settle, 400);
				});
			};
			setTimeout(settle, 400);
		});
	});
}

function tell (job, sessionId, done) {
	if (!sessionId) {
		// no Jellyfin session to show it in: a TV notification instead
		service.call('luna://com.webos.notification/createToast', {sourceId: NAME, message: job.failText}, function () { done(); });
		return;
	}
	request(job, 'POST', '/Sessions/' + sessionId + '/Message', {Header: 'Lumen', Text: job.failText, TimeoutMs: 8000}, function () { done(); });
}

var last = 'idle';
/** each play gets a number; a job that sees a newer one stops, so two plays in a row do not take turns */
var jobSeq = 0;
function stale (job) { return job.seq !== jobSeq; }

/** {url, token, deviceId, itemId, ticks, failText}: answers at once (started: true), then works in the background under an activity so the
 *  TV keeps the service running. */
service.register('play', function (message) {
	var p = message.payload || {};
	var job = {url: p.url, token: p.token, deviceId: String(p.deviceId || 'lumen'), itemId: p.itemId, ticks: Math.max(0, Math.round(Number(p.ticks) || 0)),
		failText: String(p.failText || 'Lumen could not start it: pick it here').slice(0, 200)};
	if (!BASE.test(job.url || '') || !HEX32.test(job.token || '') || !HEX32.test(job.itemId || '') || !/^[\w.-]{1,80}$/.test(job.deviceId)) {
		message.respond({returnValue: false, errorText: 'refused: play request'});
		return;
	}
	message.respond({returnValue: true, started: true});
	var started = Date.now();
	job.seq = ++jobSeq;
	last = 'looking';
	service.activityManager.create('lumen-play', function (activity) {
		var finish = function (state) { last = state; service.activityManager.complete(activity, function () {}); };
		findSession(job, started, function (sessionId) {
			if (!sessionId) { if (stale(job)) finish('replaced'); else tell(job, null, function () { finish('no session'); }); return; }
			stopFirst(job, sessionId, function () {
				sendUntilPlaying(job, sessionId, SENDS, function (state) {
					if (state === 'playing') finish('playing ' + (Date.now() - started) + 'ms');
					else if (state === 'replaced') finish('replaced');
					else tell(job, sessionId, function () { finish('failed'); });
				});
			});
		});
	});
});

/** How the last play went (for checking from DevTools). */
service.register('status', function (message) { message.respond({returnValue: true, last: last}); });
