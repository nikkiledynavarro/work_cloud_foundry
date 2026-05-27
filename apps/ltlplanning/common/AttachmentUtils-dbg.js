sap.ui.define([
	"sap/m/MessageBox",
	"sap/ui/core/BusyIndicator",
	"sap/m/MessageToast",

], function (MessageBox, BusyIndicator, MessageToast) {
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
								oCurrFile.attachDeletePress("click", function (oEvent) {
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
		uploadAttachment: function (aFiles) {
			//start upload data
			var oFile;
			var aPayloadFiles = [];
			aFiles.forEach(function (item) {
				oFile = {
					Filesize: item.info.Filesize,
					Filetype: item.info.Filetype,
					Filename: item.info.Filename,
					Bydate: item.info.ByDate,
					Mimetype: item.info.MimeType,
					Filedata: item.data
				};
				aPayloadFiles.push(oFile);
			});
			return aPayloadFiles;
		},

		_buildAttachmentForUpload: function (aSource) {
			var aUploadDocs = [];
			aSource.forEach(function (oFile, nIdx) {
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
						Filesize: oFile.size.toString(),
						Filetype: sFileExt,
						Filename: oFile.name,
						ByDate: new Date().toISOString().split("T")[0],
						MimeType: oFile.mimetype
					},
					data: base64
				};
				aUploadDocs.push(oDoc);
			});
			return aUploadDocs;
		}
	};
});