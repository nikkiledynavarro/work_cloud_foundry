sap.ui.define([
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (MessageBox, MessageToast, Filter, FilterOperator) {
	"use strict";
	var rootPath = "/sap/opu/odata/serperp/manual_srv/";
	return {
		//-----Hnadle for upload image---//
		setETDInitData: function (oController) {
			var ETDImageUploadType = [{
				key: "CUSTOM",
				text: "CUSTIMG ETD IMAGE"
			}, {
				key: "COMMERCIAL",
				text: "COMMERCIAL INVOICE IMAGE"
			}, {
				key: "CERTIFICATE",
				text: "CERTIFICATE OF ORIGIN IMAGE"
			}];
			var ETDDocShippingPoint = [{
				key: "001",
				text: "SHPOINT1"
			}];

			var ETDDocShippingDocType = [{
				key: "CERTIFICATE_OF_ORIGIN",
				text: "CERTIFICATE_OF_ORIGIN"
			}, {
				key: "COMMERCIAL_INVOICE",
				text: "COMMERCIAL_INVOICE"
			}, {
				key: "OTHER",
				text: "OTHER"
			}];
			oController.getModel("local").setProperty("/ETDImageUploadType", ETDImageUploadType);
			oController.getModel("local").setProperty("/ETDDocShippingPoint", ETDDocShippingPoint);
			oController.getModel("local").setProperty("/ETDDocShippingDocType", ETDDocShippingDocType);
		},
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
		},

		_buildDataForUpload: function (oFile) {
			var aFilesName = oFile.name.split(".");
			var sFileExt = aFilesName[aFilesName.length - 1]; // file extenstion

			//Test base 64
			var binary = '';
			var bytes = new Uint8Array(oFile.data); //eslint-disable-line
			var len = bytes.byteLength;
			for (var i = 0; i < len; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			var base64 = window.btoa(binary);
			var oDoc = {
				info: {
					FileSize: oFile.size.toString(),
					FileType: sFileExt,
					FileName: oFile.name,
					ByDate: new Date().toISOString().split("T")[0],
					MimeType: oFile.mimetype
				},
				data: base64, //oFile.data
			};
			return oDoc;
		},

		_uploadImage: function (oFile, oController) {
			oController.showBusy();
			/*
			 * Start upload data
			 */
			// var oUploaded = $.Deferred();
			// var oFormData = new FormData();
			// oFormData.append("FileSize", oFile.info.FileSize); //eslint-disable-line
			// oFormData.append("FileType", oFile.info.FileType); //eslint-disable-line
			// oFormData.append("FileName", oFile.info.FileName); //eslint-disable-line
			// oFormData.append("ByDate", oFile.info.ByDate); //eslint-disable-line
			// oFormData.append("MimeType", oFile.info.MimeType); //eslint-disable-line
			// oFormData.append("Type", oFile.data.Type); //eslint-disable-line
			// // var fileData = new Blob([oFile.data]);
			// // oFormData.append("files", fileData); //eslint-disable-line
			// var sURL = rootPath + "FedexETDUploadImageSet";

			/*
			 * Get Token for post data
			 */
			var oModel = oController.getView().getModel();
			oModel.refreshSecurityToken();
			var oHeaders = oModel.oHeaders;
			var xCSRFToken = oHeaders['x-csrf-token'];

			//Set data
			var oETDUpload = oController.getModel("local").getProperty("/ETDUpload");
			oETDUpload.DeliveryNumber = oController.sInputIDs; //Temporary get 1 delivery
			oETDUpload.CarrierCode = oController.sCarrier;
			var slugData = oETDUpload.DeliveryNumber + "|" + oETDUpload.CarrierCode + "|" + oETDUpload.ImageID + "|" + oETDUpload.Usage + "|" +
				oFile.info.FileName + "|" + oFile.info
				.FileSize + "|" + oFile.info.FileType;
			var oCustomHeader = {
				"X-CSRF-Token": xCSRFToken,
				"slug": slugData
			};
			oModel.setHeaders(oCustomHeader);
			//Start upload process
			// oModel.create("/FedexETDUploadImageSet",
			// payLoad, {
			// oModel.create("/ETDUploadImageSet", {
			// 	data: oFile.data,
			// 	ContentType: oFile.info.MimeType,
			// 	method: "POST",
			// 	success: function (data) {
			// 		oController.hideBusy();
			// 		console.log('Upload done', data); //eslint-disable-line

			// 	},
			// 	error: function (e) {
			// 		console.log('Upload err', e); //eslint-disable-line
			// 		oController.hideBusy();
			// 	}
			// });
			oModel.create("/ETDUploadImageSet", {
				data: oFile.data,
				ContentType: oFile.info.MimeType,
			}, {
				method: "POST",
				success: function (oData) {
					MessageToast.show("Upload success");
					oController.hideBusy();
				}.bind(this),
				error: function (oError) {
					console.log('Upload err', oError); //eslint-disable-line
					oController.hideBusy();
					MessageBox.error(oError.responseText);
				}.bind(this)
			});
			// oModel.create('/ETDUploadImageSet', oFile.data, null, function () {
			// 	oController.hideBusy();
			// 	console.log('Upload done', data); //eslint-disable-line
			// }, function (e) {
			// 	console.log('Upload err', e); //eslint-disable-line
			// 	oController.hideBusy();
			// });

			// $.ajax({
			// 	url: sURL,
			// 	data: oFile.data,
			// 	dataType: 'json',
			// 	headers: {
			// 		"X-CSRF-Token": xCSRFToken,
			// 		"slug": "IMAGE",
			// 		"Content-Type": oFile.info.FileType
			// 	},
			// 	cache: false,
			// 	type: "POST",
			// 	method: 'POST',
			// 	success: function (oResponse) {
			// 		oUploaded.resolve(oResponse);

			// 	}.bind(oController),
			// 	error: function (oError) {
			// 		oController.hideBusy();
			// 		oUploaded.reject();
			// 	}.bind(oController)
			// });
			//end upload data

			// return oUploaded.promise();
		},
		_uploadDocument: function (oFile, oController) {
			// oController.showBusy();

			/*
			 * Get Token for post data
			 */
			var oModel = oController.getView().getModel();
			oModel.refreshSecurityToken();
			var oHeaders = oModel.oHeaders;
			var xCSRFToken = oHeaders['x-csrf-token'];

			//Set data
			var oBasicData = oController.getModel("local").getProperty("/basic");
			var ShipFromCtry = oBasicData.partners.shipfrom.address.country;
			var ShipToCtry = oBasicData.partners.shipto.address.country;
			var oETDUpload = oController.getModel("local").getProperty("/ETDUpload");
			oETDUpload.DeliveryNumber = oController.sInputIDs; //Temporary get 1 delivery
			oETDUpload.CarrierCode = oController.sCarrier;
			var slugData = oETDUpload.DeliveryNumber + "|" + oETDUpload.CarrierCode + "|" + oETDUpload.ShippingPoint + "|" + oETDUpload.CustomerReference +
				"|" +
				oETDUpload.ShippingDocumentType + "|" +
				ShipFromCtry + "|" +
				ShipToCtry + "|" + oFile.info.FileName + "|" + oFile.info
				.FileSize + "|" + oFile.info.FileType;
			var oCustomHeader = {
				"X-CSRF-Token": xCSRFToken,
				"slug": slugData
			};
			oModel.setHeaders(oCustomHeader);
			oModel.create("/ETDUploadDocSet", {
				data: oFile.data,
				ContentType: oFile.info.MimeType
			}, {
				method: "POST",
				success: function (oData) {
					MessageToast.show("Upload success");
					oController.hideBusy();
				}.bind(this),
				error: function (oError) {
					console.log('Upload err', oError); //eslint-disable-line
					MessageBox.error(oError.responseText);
					oController.hideBusy();
				}.bind(this)
			});
		},
		//----------------------------Comon Function-------------------------------------//

		_validateUploadImageData: function (oSubmitData, oController) {
			var injectIdx = oSubmitData.ImageID.indexOf("|");
			if (oController.oUploadFile.data === undefined || oSubmitData.ImageID === "" || injectIdx !== -1 || oSubmitData.Usage === "") {
				return {
					message: oController.oBundle.getText("etdUploadValidateImageUpload"),
					isValid: false
				};
			} else {
				return {
					message: "",
					isValid: true
				};
			}
		},

		_validateUploadDocData: function (oSubmitData, oController) {
			var injectIdx = oSubmitData.CustomerReference.indexOf("|");
			if (oController.oUploadFile.data === undefined || oSubmitData.ShippingPoint === "" || oSubmitData.CustomerReference === "" ||
				injectIdx !== -1 || oSubmitData.ShippingDocumentType ===
				"") {
				return {
					message: oController.oBundle.getText("etdUploadValidateDocUpload"),
					isValid: false
				};
			} else {
				return {
					message: "",
					isValid: true
				};
			}
		},

		_buildEmptyUploadData: function (oController) {
			oController.oDoc = {};
			oController.oImage = {};
			oController.oUploadFile = {};
			oController.byId("imageUploader").clear();
			oController.byId("docUploader").clear();
			var oCurrETDData = oController.getModel("local").getProperty("/ETDUpload");
			var imageId = oCurrETDData.ImageID;
			var InitEmptyData = {
				ImageID: imageId,
				Usage: "",
				UploadType: "",
				ShippingPoint: "",
				CustomerReference: "",
				ShippingDocumentType: ""
			};
			oController.getModel("local").setProperty("/ETDUpload", InitEmptyData);
		},

		_buildInitEmptyUploadData: function (oController, imageId) {
			oController.oDoc = {};
			oController.oImage = {};
			oController.oUploadFile = {};
			var InitEmptyData = {
				ImageID: imageId,
				Usage: "",
				UploadType: "",
				ShippingPoint: "",
				CustomerReference: "",
				ShippingDocumentType: ""
			};
			oController.getModel("local").setProperty("/ETDUpload", InitEmptyData);
		},
		_setImageUploadData: function (oController, imageData) {
			oController.oDoc = {};
			oController.oImage = {};
			oController.oUploadFile = {};
			var InitEmptyData = {
				ImageID: imageData.ImageID,
				Usage: imageData.Usage,
				UploadType: imageData.UploadType,
				ShippingPoint: "",
				CustomerReference: "",
				ShippingDocumentType: ""
			};
			oController.getModel("local").setProperty("/ETDUpload", InitEmptyData);
		}
	};
});