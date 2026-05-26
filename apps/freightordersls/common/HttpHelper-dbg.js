sap.ui.define([
	"sap/m/MessageBox",
	"sap/ui/core/BusyIndicator",
	"com/erpis/shiperp/sls/freightordersls/common/Utils",
], function (MessageBox, BusyIndicator, Utils) {
	"use strict";

	return {

		/**
		 * Send GET type HTTP request using jquery ajax (expect json data type response by default)
		 * @param {string} url - url to which the request is sent
		 * @param {function} fnSuccess - callback function called when the request succeeds 
		 * @param {function} fnError - callback function called when the request fails 
		 * @param {Object} oSettings - Custom settings for ajax function in key-value format (currently support: headers, async, cache, dataType)
		 */
		getData: function (url, fnSuccess, fnError, oSettings) {
			if (typeof oSettings === "undefined") {
				oSettings = {
					async: true,
					cache: true,
					dataType: 'json'
				};
			}
			var headers = {
				"Accept-Language": sap.ui.getCore().getConfiguration().getLanguageTag()
			};
			// let {
			// 	headers = {},
			// 		async = true,
			// 		cache = true,
			// 		dataType = 'json',
			// } = oSettings;
			return jQuery.ajax({
				url: url, // url
				type: "GET", // Request type - Get
				dataType: oSettings.dataType, // Return datatype,
				cache: oSettings.cache,
				headers: headers,
				success: function (data) { //eslint-disable-line
					if (fnSuccess) {
						fnSuccess(data);
					}
				},
				error: function (error) {
					if (fnError) {
						fnError(error);
						return;
					}

					MessageBox.error(error);
				},
				async: oSettings.async
			});
		},

		/**
		 * Send POST type HTTP request using jquery ajax (expect json data type response by default)
		 * @param {string} url - url to which the request is sent
		 * @param {Object} oSubmitData - input data to be submit with the request
		 * @param {function} fnSuccess - callback function called when the request succeeds
		 * @param {function} fnError - callback function called when the request fails 
		 * @param {Object} oSettings - Custom settings for ajax function in key-value format (currently support: headers, async, contentType, dataType)
		 */
		postData: function (url, oSubmitData, fnSuccess, fnError, oSettings) {
			var oDeferred = $.Deferred();
			if (typeof oSettings === "undefined") {
				oSettings = {
					async: true,
					dataType: 'json',
					contentType: 'application/json; charset=utf-8'
				};
			}
			var headers = {
				"Accept-Language": sap.ui.getCore().getConfiguration().getLanguageTag()
			};

			jQuery.ajax({
				url: url, // url
				type: "POST", // Request type - Post
				dataType: oSettings.dataType, // Return datatype,
				contentType: oSettings.contentType,
				data: JSON.stringify(oSubmitData),
				headers: headers,
				// statusCode: {
				// 	MessageBox.error(sMessage);
				// 	BusyIndicator.hide();
				// 	oDeferred.reject();
				// },
				success: function (response) {
					if (fnSuccess) {
						fnSuccess(response);
					}
					oDeferred.resolve();
				},
				error: function (error) {
					BusyIndicator.hide();
					if (fnError) {
						fnError(error);
						return;
					}
					MessageBox.error(error);
					oDeferred.reject();
				},
				async: oSettings.async
			});
			return oDeferred;
		}, //end

		_getTokenPath: function () {
			var path = Utils.getTokenPath(); //Moved to Utils to avoid load conflict Tim 2020/09/10
			return path;
		}
	};
});