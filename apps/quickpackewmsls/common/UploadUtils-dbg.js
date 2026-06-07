sap.ui.define([
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (MessageBox, MessageToast, Filter, FilterOperator) {
	"use strict";
	return {

		_handleUploadChange: function (oFile, oController) {
			//handle file data
			var oFileRaw = {
				name: oFile.name,
				mimetype: oFile.type,
				size: oFile.size,
				data: []
			};
			//reader
			var reader = new FileReader();
			reader.onload = function (e) {
				oFileRaw.data = e.target.result; //set buffer data
				oController.oUploadFile = oFileRaw;
			}.bind(oController);
			reader.readAsArrayBuffer(oFile);
		}
	};
});