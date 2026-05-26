sap.ui.define([
	"com/erpis/shiperp/freightauditupload/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"com/erpis/shiperp/freightauditupload/model/formatter",
	"sap/m/MessageBox",
	"sap/ui/model/Filter"
], function (BaseController, JSONModel, formatter, MessageBox, Filter) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.freightauditupload.controller.Main", {

		oBundle: null,
		formatter: formatter,

		onInit: function () {
			// Set the controller property to be used globally in the controller
			this.oBundle = this.getResourceBundle();

			// Local Model for view
			this.setModel(new JSONModel({
				LocalDirectory: {
					Vendor: "",
					AuditFile: {
						FilePath: "", // File Name
						FileData: "", // base64 content,
					},
					HeaderRow: true,
				},
				ServerDirectory: {
					Vendor: "",
					HeaderRow: true
				},
				isDirTypeVisible: false,
				mode: 'LocalDirectory'
			}), "local");

			this.getView().getModel("local").setProperty("/RowSelected", false);

			// Initialize Message Model
			var oModelMessage = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oModelMessage, "messageModel");

			this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 **/
		_onObjectMatched: function (oEvent) {
			this.showBusy();
			this.getModel().read("/Login", {
				success: function (oData) {
					this.getView().getModel("local").setProperty("/isDirTypeVisible", oData.Login.DirectoryType);
					this.hideBusy();
				}.bind(this)
			});
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		onSelectDirType: function (oEvent) {
			var oGroup = oEvent.getSource();
			var iIndex = oGroup.getSelectedIndex();
			var oSelectedRadio = oGroup.getButtons()[iIndex];
			var sMode = oSelectedRadio.data("mode");
			this.getView().getModel("local").setProperty("/mode", sMode);
		},

		/* ============================ Upload Data =============================== */
		onImportDataFileChange: function (oEvent) {
			var index = 0; //Always upload 1 file
			this.oDoc = oEvent.getParameters().files[index];
			if (this.oDoc) {
				this._handleUploadChange(this.oDoc, this);
			} else if (this.oDoc === undefined) {
				this.oDoc = {};
				this.oUploadFile = {};
			}
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

		_getFileBase64: function () {
			if (!this.oUploadFile || !this.oUploadFile.name) {
				sap.m.MessageBox.warning("Please select at least one file");
				return null;
			}
			// Check FileReader 
			if (!this.oUploadFile.data) {
				sap.m.MessageBox.warning("File is still loading. Please wait a moment and try again.");
				return null;
			}
			// Build base64
			return this._convertArrayBufferToBase64(this.oUploadFile.data);
		},

		_convertArrayBufferToBase64: function (aBuffer) {
			var binary = "";
			var bytes = new Uint8Array(aBuffer);
			var len = bytes.byteLength;
			for (var i = 0; i < len; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			return window.btoa(binary);
		},

		onServerDirectoryConf: function (oEvent) {
			this.showBusy();
			this.getModel().read("/FreightAuditUploadSet", {
				urlParameters: {
					"$expand": "Return,UploadDIR"
				},
				success: function (oData) {
					this.getView().getModel("local").setProperty("/UploadDirectory", oData.results[0].UploadDIR.results);
					if (!this.oUploadDirectory) {
						this.oUploadDirectory = sap.ui.xmlfragment("com.erpis.shiperp.freightauditupload.fragment.UploadDirectoryTemplate",
							this);
						this.getView().addDependent(this.oUploadDirectory);
					}
					this.oUploadDirectory.open();
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		onCancelUpload: function () {
			this.oUploadDirectory.close();
		},

		onSaveData: function (oEvent) {
			this.showBusy();
			var oRequestPayload = this.generateUploadDIRPayload();
			this.getModel().create("/FreightAuditUploadSet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessagess(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generateUploadDIRPayload: function () {
			var oPayload = {
				Action: "SaveUploadDIR",
				UploadDIR: this.getModel("local").getProperty("/UploadDirectory") || {},
				Return: []
			};
			return oPayload;
		},

		onAddTemplate: function () {
			var oModel = this.getView().getModel("local");
			oModel.setProperty("/Mode", "Add");
			oModel.setProperty("/Current", {
				CarrierCode: "",
				Program: "",
				DirectoryType: "",
				Counter: "",
				DirectoryName: "",
				FileName: ""
			});
			this._openAddEditDialog();
		},

		_openAddEditDialog: function () {
			if (!this._oAddEditDialog) {
				this._oAddEditDialog = sap.ui.xmlfragment(
					"com.erpis.shiperp.freightauditupload.fragment.AddEditDirectory",
					this
				);
				this.getView().addDependent(this._oAddEditDialog);
			}

			this._oAddEditDialog.open();
		},

		onCancelAddEdit: function () {
			this._oAddEditDialog.close();
		},

		onEditTemplate: function () {
			var oTable = sap.ui.getCore().byId("idLoadTemplate");
			var aIndices = oTable.getSelectedIndices();
			if (aIndices.length === 0) {
				sap.m.MessageToast.show("Please select a row to edit");
				return;
			}
			if (aIndices.length > 1) {
				sap.m.MessageToast.show("Please select only one row to edit");
				return;
			}
			var iIndex = aIndices[0];
			var oContext = oTable.getContextByIndex(iIndex);
			var oData = oContext.getObject();
			var oModel = this.getView().getModel("local");
			oModel.setProperty("/Mode", "Edit");
			oModel.setProperty("/Current", Object.assign({}, oData));
			this._iEditIndex = iIndex;
			this._openAddEditDialog();
		},

		onSaveDirectory: function () {
			var oModel = this.getView().getModel("local");
			var sMode = oModel.getProperty("/Mode");
			var oCurrent = oModel.getProperty("/Current");
			var aData = oModel.getProperty("/UploadDirectory") || [];
			var aFields = [];
			var fieldIds = {
				CarrierCode: "idCarr",
				Program: "idProg",
				DirectoryType: "idDirecType",
				Counter: "idCount"
			};

			if (!this._checkRequired(oCurrent, fieldIds)) {
				return;
			}

			var aValidateData = aData.slice();
			// --- Remove current editing row before checking duplicate ---
			if (sMode === "Edit" && this._iEditIndex !== undefined) {
				aValidateData.splice(this._iEditIndex, 1);
			}
			//  Dynamic duplicate check 
			aFields = ["CarrierCode", "Program", "DirectoryType"];
			var mLabels = {
				CarrierCode: "Carrier Code",
				Program: "Program Name",
				DirectoryType: "Directory Type",
				Counter: "Counter"
			};
			// Check if combination of 3 fields already exists
			var bCombinationExist = aValidateData.some(function (oItem) {
				return aFields.every(function (sField) {
					return oItem[sField] === oCurrent[sField];
				});
			});

			var sDuplicateField = null;

			if (bCombinationExist) {
				// Only check Counter duplicate
				var bDuplicateCounter = aValidateData.some(function (oItem) {
					return oItem.CarrierCode === oCurrent.CarrierCode &&
						oItem.Program === oCurrent.Program &&
						oItem.DirectoryType === oCurrent.DirectoryType &&
						oItem.Counter === oCurrent.Counter;
				});

				if (bDuplicateCounter) {
					sap.m.MessageBox.error("Duplicate Counter found!");
					return;
				}
			} else {
				aFields.push("Counter");
				aValidateData.some(function (oItem) {
					for (var i = 0; i < aFields.length; i++) {
						var sField = aFields[i];
						if (oItem[sField] === oCurrent[sField] && oCurrent[sField]) {
							sDuplicateField = sField;
							return true;
						}
					}
					return false;
				});

				if (sDuplicateField) {
					sap.m.MessageBox.error("Duplicate " + mLabels[sDuplicateField] + " found!");
					return;
				}
			}

			//---- Save----
			if (sMode === "Add") {
				aData.push(Object.assign({}, oCurrent));
				oModel.setProperty("/UploadDirectory", aData);
			} else {
				oModel.setProperty("/UploadDirectory/" + this._iEditIndex, Object.assign({}, oCurrent));
			}

			this._oAddEditDialog.close();
		},

		_checkRequired: function (Value, fieldIds) {
			var hasError = false;
			for (var key in fieldIds) {
				var oControl = sap.ui.getCore().byId(fieldIds[key]);
				var sValue = Value[key];
				if (!sValue) {
					if (oControl) {
						oControl.setValueState("Error");
					}
					hasError = true;
				} else {
					if (oControl) {
						oControl.setValueState("None");
					}
				}
			}
			return !hasError;
		},

		onCancelDirectory: function () {
			this._oAddEditDialog.close();
		},

		onDelete: function () {
			var oTable = sap.ui.getCore().byId("idLoadTemplate");
			var oModel = this.getView().getModel("local");
			var aSelectedIndices = oTable.getSelectedIndices();

			if (aSelectedIndices.length === 0) {
				return;
			}

			var aData = oModel.getProperty("/UploadDirectory");

			MessageBox.confirm(
				this.oBundle.getText("confirmDeleteDirectoryMessage"), {
					title: this.oBundle.getText("ConfirmDeletion"),
					actions: [
						sap.m.MessageBox.Action.YES,
						sap.m.MessageBox.Action.NO
					],
					initialFocus: sap.m.MessageBox.Action.YES,
					onClose: function (oAction) {
						if (oAction === sap.m.MessageBox.Action.YES) {
							aSelectedIndices.sort(function (a, b) {
								return b - a;
							});

							aSelectedIndices.forEach(function (iIndex) {
								aData.splice(iIndex, 1);
							});

							oModel.setProperty("/UploadDirectory", aData);
							oTable.clearSelection();

							sap.m.MessageToast.show(
								this.oBundle.getText("deleteSuccessMessage")
							);
						}
					}.bind(this)
				}
			);
		},

		onSelectionTemplate: function (oEvent) {
			var oTable = oEvent.getSource();
			var bHasSelection = oTable.getSelectedIndices().length > 0;

			var oModel = this.getView().getModel("local");
			oModel.setProperty("/RowSelected", bHasSelection);
		},

		onTableUpdateFinished: function (oEvent) {
			var oTable = oEvent.getSource();
			var oModel = this.getView().getModel("local");
			var bHasSelection = !!oTable.getSelectedItem();
			var bHasItems = oTable.getItems().length > 0;
			oModel.setProperty("/RowSelected", bHasSelection);
			if (!bHasItems) {
				oTable.removeSelections(true);
			}
		},

		/* ============================ Handle Execute =============================== */
		onExecute: function (oEvent) {
			var oLocalDirectory = {};
			var sMode = this.getView().getModel("local").getProperty("/mode");
			var oUpload = this.getModel("local").getProperty("/LocalDirectory") || {};
			if (sMode === 'LocalDirectory') {
				var sBase64 = this._getFileBase64();
				if (!sBase64) {
					return;
				}
				oLocalDirectory = {
					Vendor: oUpload.Vendor || "",
					HeaderRow: oUpload.HeaderRow,
					AuditFile: {
						FilePath: this.oUploadFile.name, // File Name
						FileData: sBase64, // base64 content
					}
				};
			}
			this.showBusy();
			var oRequestPayload = this.generatePayload(oLocalDirectory);
			this.getModel().create("/FreightAuditUploadSet", oRequestPayload, {
				success: function (oData) {
					if (oData.Return && oData.Return.results.length > 0) {
						var aMsg = this._generateMessagess(oData.Return.results);
						this._addMessage(aMsg);
						if (aMsg.length > 0) this.byId('popoverButton').firePress();
					}
					this.hideBusy();
				}.bind(this), //eslint-disable-line
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		generatePayload: function (oLocalDirectory) {

			var oPayload = {
				Action: "Execute",
				LocalDirectory: oLocalDirectory,
				ServerDirectory: this.getModel("local").getProperty("/ServerDirectory") || {},
				Return: []
			};
			return oPayload;
		},

		onNavRequestForPickup: function (oEvent) {
			var shellHash = oEvent.getSource().data("crossNavigate");

			if (!shellHash) {
				return;
			}
			var xnavservice = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService && sap.ushell.Container.getService(
				"CrossApplicationNavigation");
			xnavservice.toExternal({
				target: {
					shellHash: shellHash
				}
			});
		},
	});
});