sap.ui.define([
	"sap/m/MessageBox",
	"sap/ui/core/BusyIndicator",
	"sap/m/MessageToast",
	"com/erpis/shiperp/freightorderplanning/common/HttpHelper",
], function (MessageBox, BusyIndicator, MessageToast, HttpHelper) {
	"use strict";

	return {
		/*=====================================================================
		Handle trigger event change (Add, Remove) file
		=====================================================================*/
		_handleUploadUserProfilesAttachmentChange: function (oUploadCollection, oFile, oController) {
			if (oFile) {
				var oFileRaw = {
					name: oFile.name,
					mimetype: oFile.type,
					size: oFile.size,
					data: []
				};
				//process file data
				var oThis = this;
				var reader = new FileReader();
				reader.onload = function (e) {
					var aFiles = oUploadCollection.getItems();
					for (var i = 0; i < aFiles.length; i++) {
						var oCurrFile = aFiles[i];
						if (oCurrFile.getFileName() === oFileRaw.name) {
							oFileRaw.data = e.target.result; //set buffer data
							var aUploadFiles = oController.aUserUploadFiles;
							var oCheckDup = oThis._isExistFile(oUploadCollection, oController.aUserUploadFiles, oCurrFile, oFileRaw, true);
							if (oCheckDup.exist === false) {
								oController.aUserUploadFiles.push(oFileRaw);
								//add remove file handle
								oCurrFile.attachDevarePress("click", function (oEvent) {
									var oCurrDevareFile = oEvent.getSource();
									MessageBox.confirm("Are you sure you want to remove file: " + oCurrDevareFile.getFileName() + " from list?", {
										actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
										onClose: function (sAction) {
											if (sAction === "OK") {
												oThis._removeExistFile(oUploadCollection, aUploadFiles, oCurrDevareFile, oFileRaw);
											} else if (sAction === "CANCEL") {
												return;
											}
										}
									});
								});
							} else {
								MessageToast.show("This file have already existed in this list, please select another file");
							}
						}
					}
				}.bind(oController);
				reader.readAsArrayBuffer(oFile);
			}
		},

		_removeExistFile: function (oUploadCollection, aUploadFiles, oCurrDevareFile, oFileRaw) {
			oUploadCollection.removeItem(oCurrDevareFile);
			if (aUploadFiles) {
				var nFileIdx = "";
				for (var i = 0; i < aUploadFiles.length; i++) {
					if (aUploadFiles[i].name === oFileRaw.name) {
						nFileIdx = i;
					}
				}
				if (nFileIdx !== -1) {
					aUploadFiles.splice(nFileIdx, 1);
				}
			}
		},

		_isExistFile: function (oUploadCollection, aUserUploadFiles, oCurrFile, oFileRaw, bRemove) {
			var oThis = this;
			var oCheck = {
				exist: false,
				index: 0
			};
			if (aUserUploadFiles.length > 0) {
				var aExist = oThis._getExistItemsArray(aUserUploadFiles, "name", oFileRaw.name);
				var nFileIdx = "";
				for (var i = 0; i < aUserUploadFiles.length; i++) {
					if (aUserUploadFiles[i].name === oFileRaw.name) {
						nFileIdx = i;
					}
				}
				if (aExist.length > 1 && nFileIdx !== -1) {
					if (bRemove === true) {
						for (var f = 0; f < aExist.length - 1; f++) {
							for (var j = 0; j < aUserUploadFiles.length; j++) {
								if (aUserUploadFiles[j].name === aExist[f].name) {
									nFileIdx = j;
								}
							}
							aUserUploadFiles.splice(nFileIdx, 1);
						}
						oUploadCollection.removeItem(oCurrFile);
					}
					oCheck.exist = true;
					oCheck.index = nFileIdx;
				}
			}
			return oCheck;
		},

		_getExistItemsArray: function (aSArray, sColumn, sKeyVal) {
			var aItems = aSArray.filter(function (obj) {
				return obj[sColumn] === sKeyVal;
			});
			return aItems;
		},

		/*=====================================================================
		Hanlde build structure file before submit in gateway
		=====================================================================*/
		uploadAttachment: function (aFiles, aPickupDetails, oController) {
			oController.showBusy();
			var oThis = this;
			oThis._processUploadFile(aFiles, aPickupDetails, oController);
		},

		_processUploadFile: function (aFiles, aPickupDetails, oController) {
			sap.ui.core.BusyIndicator.show();
			//start upload data
			var oUploaded = $.Deferred();
			var oFile;
			var aPayloadFiles = [];
			// var oFormData = new FormData();
			aFiles.forEach(function (item) {
				oFile = {
					FileSize: item.info.FileSize,
					FileType: item.info.FileType,
					FileName: item.info.FileName,
					ByDate: item.info.ByDate,
					MimeType: item.info.MimeType,
					FileData: new Blob([item.data])
				};
				aPayloadFiles.push(oFile);
			});

			// var oPayloadData = {
			// 	PayloadFiles: aPayloadFiles,
			// 	PickupDetails: aPickupDetails
			// };
			// oFormData.append("Attachments", JSON.stringify(aPayloadFiles)); //eslint-disable-line
			// oFormData.append("PackageDetails", JSON.stringify(aPickupDetails)); //eslint-disable-line
			//Prepare AJAX Request
			var oAjaxReq = {
				url: oController.getMainSrv() + "xSERPTMxFORequestPickupDetailSet",
				data: JSON.stringify({
					Attachments: JSON.stringify(aPayloadFiles),
					PackageDetails: JSON.stringify(aPickupDetails)
				}),
				headers: {
					"Accept-Language": sap.ui.getCore().getConfiguration().getLanguageTag()
				},
				cache: false,
				contentType: "application/json; charset=utf-8",
				processData: false,
				type: "POST",
				method: 'POST',
				success: function (oResponse) {
					MessageBox.show("Send Email Successfully");
					sap.ui.core.BusyIndicator.hide();
					oUploaded.resolve();
				}.bind(this),
				error: function (oError) {
					sap.ui.core.BusyIndicator.hide();
					oUploaded.resolve(oError);
				}.bind(this)
			};
			//get Token for post data
			var sTokenPath = HttpHelper._getTokenPath();
			jQuery.ajax({
				url: sTokenPath + "/sap/opu/odata/SERPTM/FRT_ORDPL_SRV", // url
				type: "GET", // Request type - Get
				headers: {
					"X-CSRF-Token": "fetch"
				},
				success: function (resdata, headers, request) {
					var sToken = request.getResponseHeader("X-CSRF-Token");
					oAjaxReq.headers["X-CSRF-Token"] = sToken;
					$.ajax(oAjaxReq);
					//end upload data
				},
				error: function (error) {
					sap.ui.core.BusyIndicator.hide();
				}
			});
			return oUploaded.promise();
		},

		_buildAttachmentForUpload: function (aSource) {
			var aUploadDocs = [];
			aSource.forEach(function (oFile, nIdx) {
				var aFilesName = oFile.name.split(".");
				var sFileExt = aFilesName[aFilesName.length - 1]; // file extenstion
				var oDoc = {
					info: {
						FileSize: oFile.size.toString(),
						FileType: sFileExt,
						FileName: oFile.name,
						ByDate: new Date().toISOString().split("T")[0],
						MimeType: oFile.mimetype
					},
					data: oFile.data
				};
				aUploadDocs.push(oDoc);
			});
			return aUploadDocs;
		}
	};
});