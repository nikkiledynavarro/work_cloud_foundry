/*global location*/
sap.ui.define([
	"com/erpis/shiperp/dispute/hr7/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"com/erpis/shiperp/dispute/hr7/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/m/UploadCollectionParameter",
	"com/erpis/shiperp/dispute/hr7/common/Utils"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageToast, MessageBox, UploadCollectionParameter,
	Utils) {
	"use strict";

	return BaseController.extend("com.erpis.shiperp.dispute.hd6.controller.DisputeDetail", {

		formatter: formatter,
		sFilterKey: "A",
		sCoCode: "",

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			// Local model for view
			var oViewModel = new JSONModel({
				aSelectedShippingPoints: []
			});
			this.setModel(oViewModel, "local");

			// When ever user go to the route "disputeDetail", trigger this._onObjectMatched()
			this.getRouter().getRoute("disputeDetail").attachPatternMatched(this._onObjectMatched, this);

			// Initialize Message Model
			var oJSONModel = new JSONModel({
				aMessages: [],
				messagesLength: 0
			});
			this.setModel(oJSONModel, "messageModel");

			// Assign resource bundle
			this.oBundle = this.getResourceBundle();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		/**
		 * Event handler when a table cell gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onCreditAmtPress: function (oEvent) {
			var oSelectedDispute = oEvent.getSource().getBindingContext().getObject();
			this.getModel("local").setProperty("/selectedDisputeDetail", oSelectedDispute);
			this.oCreditAmtDialog = Utils.getFragment(null, "CreditAtmUpdate", this);
			this.oCreditAmtDialog.open();
		},

		onDisputeDetailUpdateFinished: function (oEvent) {
			var oTable = oEvent.getSource();
			this.getModel("local").setProperty("/totalLineItem", oTable.getItems().length);
			this.hideBusy();
		},

		onCreditClear: function () {
			var oCreditAmount = this.byId(this.getView().createId("idCreditAmountInput"));
			oCreditAmount.setValue(0);
			oCreditAmount.setValueState("None");
		},

		onReasonNodeDialogClose: function () {
			var oCreditAmount = this.byId(this.getView().createId("idDisputeCreditAmountInput"));
			oCreditAmount.setValue(0);
			oCreditAmount.setValueState("None");
		},

		onCreditSave: function () {
			var oCreditAmount = this.byId(this.getView().createId("idCreditAmountInput"));
			if (oCreditAmount.getValueState() === "Error") {
				return;
			}
			var oSelctedItem = this.getModel("local").getProperty("/selectedDisputeDetail");
			this._updateCredit(oSelctedItem, oCreditAmount.getValue());
		},

		onCreditClose: function () {
			this.oCreditAmtDialog.close();
		},

		onAfterRendering: function () {
			this.checkSapUi5Version();
		},

		checkSapUi5Version: function () {
			var oTable = this.byId("idDisputeDetailTab");
			if (parseFloat(sap.ui.version) < 1.44) {
				oTable.addStyleClass("sapUiMediumMarginBottom");
			} else {
				oTable.removeStyleClass("sapUiMediumMarginBottom");
			}
		},

		fnValidateNumberic: function (oEvent) {
			var oControl = oEvent.getSource();
			var isValid = true;
			var oValue = oControl.getValue();
			if (oValue === "") {
				isValid = false;
			}
			// is number?
			if (isNaN(oValue)) {
				isValid = false;
			}
			if (oValue < 0) {
				isValid = false;
			}
			if (isValid) {
				oControl.setValueState(sap.ui.core.ValueState.None);
				oControl.setValueStateText("");
				oControl.setTooltip("");
			} else {
				oControl.setValueState(sap.ui.core.ValueState.Error);
				oControl.setValueStateText(this.oBundle.getText("ERR_NON_NUMBER_OR_NEGATIVE_NUMBER"));
				oControl.setTooltip(this.oBundle.getText("ERR_NON_NUMBER_OR_NEGATIVE_NUMBER_TOOLTIP"));
			}

		},

		onClearMessages: function () {
			this._clearMessages(this, "local");
		},

		onCompleteConfirm: function (oEvent) {
			var oControl = oEvent.getSource();
			var sStatus = oControl.data("status");
			var sTitleKey = "";
			var oDispute = this.getView().getBindingContext().getObject();
			var oMsgKey = "";

			if (sStatus === "C" && oDispute.Status !== "IP") {
				MessageBox.error(this.oBundle.getText("sbCompletedImpossible"));
				return;
			}
			if (sStatus === "C") {
				oMsgKey = "detailConfirmCompleteMsg";
				sTitleKey = "detailConfirmCompleteTitle";
			} else {
				// in process
				sTitleKey = "detailConfirmInprocessTitle";
				oMsgKey = "detailConfirmIPMsg";
			}
			MessageBox.confirm(this.oBundle.getText(oMsgKey), {
				title: this.oBundle.getText(sTitleKey),
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._toInprocess(oDispute, sStatus);
					}
				}.bind(this)
			});
		},

		onReasonSelected: function (oEvent) {
			var params = oEvent.getParameters();
			var sReasonCode = params.selectedItem.getProperty("description");
			this._cancel(sReasonCode);
		},

		onPrintPress: function () {
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			var sMsg = this.oBundle.getText("confirmPrintMsg");
			var sTitle = this.oBundle.getText("confirmPrintTitle");
			var sStatus = this.getView().getBindingContext().getObject().Status;
			var aActions = [this.oBundle.getText("txtPrintOnly")];
			if (sStatus !== "C") {
				aActions.push(this.oBundle.getText("txtPrintAndProcess"));
			}
			aActions.push(sap.m.MessageBox.Action.CANCEL);
			MessageBox.confirm(sMsg, {
				title: sTitle,
				actions: aActions,
				initialFocus: this.oBundle.getText("txtPrintOnly"),
				styleClass: bCompact ? "sapUiSizeCompact" : "",
				onClose: function (oAction) {
					var sAction = "PRINT";
					if (oAction === this.oBundle.getText("txtPrintOnly")) {
						this._doPostOrEDIOrPrintOrSendEmailDispute(sAction, "");
					} else if (oAction === this.oBundle.getText("txtPrintAndProcess")) {
						this._doPostOrEDIOrPrintOrSendEmailDispute(sAction);
					}
				}.bind(this)
			});
		},

		onEDIPress: function () {
			var sMsg = this.oBundle.getText("confirmEDIMsg");
			var sTitle = this.oBundle.getText("confirmEDITitle");
			MessageBox.confirm(sMsg, {
				title: sTitle,
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						var sAction = "EDI";
						this._doPostOrEDIOrPrintOrSendEmailDispute(sAction);
					}
				}.bind(this)
			});
		},

		onEmailPress: function () {
			var sMsg = this.oBundle.getText("confirmEmailMsg");
			var sTitle = this.oBundle.getText("confirmEmailTitle");
			MessageBox.confirm(sMsg, {
				title: sTitle,
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						var sAction = "EMAIL";
						this._doPostOrEDIOrPrintOrSendEmailDispute(sAction);
					}
				}.bind(this)
			});
		},

		onPostPress: function () {
			var sMsg = this.oBundle.getText("confirmPostMsg");
			var sTitle = this.oBundle.getText("confirmPostTitle");
			MessageBox.confirm(sMsg, {
				title: sTitle,
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						var sAction = "POST";
						this._doPostOrEDIOrPrintOrSendEmailDispute(sAction);
					}
				}.bind(this)
			});
		},

		onTabToolBarUpdate: function () {
			var oDispute = this.getView().getBindingContext().getObject();
			if (oDispute.Status !== "IP") {
				MessageBox.error(this.oBundle.getText("sbErrorUpdateNoteAtt"));
				return;
			}
			var aStatuses = [{
				code: "A",
				description: "Approved",
				state: "None"
			}, {
				code: "DN",
				description: "Denied",
				state: "None"
			}];
			this.getModel("local").setProperty("/disputeStatusList", aStatuses);
			var aDisputes = this.byId("idDisputeDetailTab").getSelectedItems();
			if (aDisputes.length === 0) {
				MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
				return;
			}
			var sUpdateStatus = "";
			if (aDisputes.length === 1) {
				var oSelectedDispute = aDisputes[0].getBindingContext().getObject();
				sUpdateStatus = oSelectedDispute.Status;
			}

			this.getModel("local").setProperty("/selectedDisputeStatus", sUpdateStatus);
			this.updateStatusDialog = Utils.getFragment(null, "StatusUpdate", this);
			var sPath = aDisputes[0].getBindingContext().getPath();
			this.updateStatusDialog.bindElement(sPath);

			var fnSuccess = function (oReturnData) {
				this.getModel("local").setProperty("/selectedDisputeDetail/Note", oReturnData.Text);
				this.hideBusy();
			}.bind(this);

			this._getDtlNotes("'" + oSelectedDispute.DisputeID + "'", "'" + oSelectedDispute.Trackpro + "'", "'ZDCA'", fnSuccess);
			this.getModel("local").setProperty("/selectedDisputeDetail", oSelectedDispute);

			var oUploadCollection = this.byId(this.createId("idStatusUploadFile"));
			var oUploadBinding = oUploadCollection.getBinding("items");
			oUploadBinding.attachDataReceived(this.onAttachmentsLoadingDone.bind(this, oUploadCollection));
			oUploadBinding.refresh();

			this.byId(this.createId("iconTabStatusUpdate")).setSelectedKey("info");
			this.getModel("local").setProperty("/enabledUploadStatusUpdate", false);
			this.updateStatusDialog.open();
		},

		onStatusClose: function () {
			this.updateStatusDialog.close();
		},

		onStatusSave: function () {
			var sUpdatedStatus = this.getModel("local").getProperty("/selectedDisputeStatus");
			var aDisputes = this.byId("idDisputeDetailTab").getSelectedItems();
			var sNote = this.getModel("local").getProperty("/selectedDisputeDetail/Note");
			this._updateItemStatus(aDisputes, sUpdatedStatus, sNote);
		},

		onSelectTab: function () {
			if (this.byId("idIconTabBarUpdateReCod").getSelectedKey() === "info") {
				this.byId("btnUpdate").setVisible(true);
				this.byId("btnUpload").setVisible(false);
			} else {
				this.byId("btnUpdate").setVisible(false);
				this.byId("btnUpload").setVisible(true);
			}
		},

		onIconSelectTab: function (oEvent) {
			var oControl = oEvent.getSource();
			if (oControl.getSelectedKey() === "info") {
				this.getModel("local").setProperty("/enabledUploadStatusUpdate", false);
			} else {
				this.getModel("local").setProperty("/enabledUploadStatusUpdate", true);
			}
		},

		onDisputeItemNotePressed: function (oEvent) {
			var sPath = oEvent.getSource().getParent().getBindingContextPath();
			this._noteAndAttachmentDialog = Utils.getFragment(null, "NoteAndAttachment", this);
			// bind dialog
			this._noteAndAttachmentDialog.bindElement(sPath);
			var oUploadCollections = this.byId(this.createId("idUploadCollection"));
			oUploadCollections.bindItems({
				path: "toATTA",
				templateShareable: false,
				template: sap.ui.xmlfragment("com.erpis.shiperp.dispute.hd6.fragment.UploadCollectionItemTemplate", this)
			});
			this.getModel("local").setProperty("/selectedDisputeDetail", {});
			var fnSuccess = function (oData) {
				var oSelectedDisputeDetail = {
					Note: oData.Text
				};
				this.getModel("local").setProperty("/selectedDisputeDetail", oSelectedDisputeDetail);
				this.hideBusy();
			}.bind(this);
			this.showBusy();
			var oData = this.getModel().getProperty(sPath);
			this._getDtlNotes("'" + oData.DisputeID + "'", "'" + oData.Trackpro + "'", "'ZDCC'",
				fnSuccess);
			this._noteAndAttachmentDialog.getElementBinding().refresh();

			//refresh the upload collection binding
			var oFormInsideDialog = this._noteAndAttachmentDialog.getContent()[0];
			var oFlexBoxInsideForm = oFormInsideDialog.getContent()[1];
			var oUploadCollectionInsideFlexBox = oFlexBoxInsideForm.getItems()[1];
			oUploadCollectionInsideFlexBox.getBinding("items").refresh();
			//Open the dialog
			this._noteAndAttachmentDialog.open();
		},

		onDisputeApprovalItemNotePressed: function (oEvent) {
			var sPath = oEvent.getSource().getParent().getBindingContextPath();
			this._noteAndAttachmentDialog = Utils.getFragment(null, "NoteAndAttachment", this);
			// bind dialog
			this._noteAndAttachmentDialog.setTitle(this.oBundle.getText("approvalNoteAndAttachmentDialogTitle"));
			this._noteAndAttachmentDialog.bindElement(sPath);
			var oUploadCollections = this.byId(this.createId("idUploadCollection"));
			oUploadCollections.bindItems({
				path: "toATTA_CARR",
				template: sap.ui.xmlfragment("com.erpis.shiperp.dispute.hd6.fragment.UploadCollectionItemTemplate", this),
				templateShareable: false
			});
			this.getModel("local").setProperty("/selectedDisputeDetail", {});
			var fnSuccess = function (oData) {
				var oSelectedDisputeDetail = {
					Note: oData.Text
				};
				this.getModel("local").setProperty("/selectedDisputeDetail", oSelectedDisputeDetail);
				this.hideBusy();
			}.bind(this);
			this.showBusy();
			var oData = this.getModel().getProperty(sPath);
			this._getDtlNotes("'" + oData.DisputeID + "'", "'" + oData.Trackpro + "'", "'ZDCA'", fnSuccess);
			this._noteAndAttachmentDialog.getElementBinding().refresh();

			//refresh the upload collection binding
			var oFormInsideDialog = this._noteAndAttachmentDialog.getContent()[0];
			var oFlexBoxInsideForm = oFormInsideDialog.getContent()[1];
			var oUploadCollectionInsideFlexBox = oFlexBoxInsideForm.getItems()[1];
			oUploadCollectionInsideFlexBox.getBinding("items").refresh();
			//Open the dialog
			this._noteAndAttachmentDialog.open();
		},

		onNoteAttachDialogClose: function () {
			this._noteAndAttachmentDialog.close();
		},

		onCheckboxItemSelect: function () {
			var oPropertyUpdate = this.getModel("local").getProperty("/propertyUpdated");
			oPropertyUpdate.selectedAll = oPropertyUpdate.isUpdateReaCode && oPropertyUpdate.isUpdateDisputeAmt && oPropertyUpdate.isUpdateNote;
			this.getModel("local").setProperty("/propertyUpdated", oPropertyUpdate);
		},

		onCheckboxSelectAll: function (oEvent) {
			var oControl = oEvent.getSource();
			var oSelected = oControl.getSelected();
			var oPropertyUpdate = this.getModel("local").getProperty("/propertyUpdated");
			oPropertyUpdate.isUpdateReaCode = oSelected;
			oPropertyUpdate.isUpdateDisputeAmt = oSelected;
			oPropertyUpdate.isUpdateNote = oSelected;
			this.getModel("local").setProperty("/propertyUpdated", oPropertyUpdate);
		},

		onChangeCodeUpdate: function () {
			var oIconTab = this.byId(this.getView().createId("idIconTabBarUpdateReCod"));
			var sIconTabKey = oIconTab.getSelectedKey();
			var aDisputesItems = this.byId(this.getView().createId("idDisputeDetailTab")).getSelectedItems();
			switch (sIconTabKey) {
			case "info":
				//Get all info on the screen
				var oDisputeCreditAmountInput = this.byId(this.getView().createId("idDisputeCreditAmountInput"));
				if (oDisputeCreditAmountInput.getValueState() === "Error") {
					return;
				}

				var oTrackingToBeUpdated = this.getModel("local").getProperty("/selectedDisputeDetail");
				var aDisputeDatas = [];
				var oPropertyUpdated = this.getModel("local").getProperty("/propertyUpdated");
				if (aDisputesItems.length > 1) {
					for (var i = 0; i < aDisputesItems.length; i++) {
						var oItemData = aDisputesItems[i].getBindingContext().getObject();
						// update with the new data.
						oItemData.ChargeCode = oTrackingToBeUpdated.ChargeCode;
						oItemData.DisputeAmt = oTrackingToBeUpdated.DisputeAmt;
						oItemData.Note = oItemData.Note || "";
						oItemData.Note = oTrackingToBeUpdated.Note || "";
						aDisputeDatas.push(oItemData);
					}
				} else {
					aDisputeDatas = [oTrackingToBeUpdated];
				}
				var sPayAmountFlag = (oPropertyUpdated.isUpdateDisputeAmt) ? "X" : "";
				var sReasonFlag = (oPropertyUpdated.isUpdateReaCode) ? "X" : "";
				var sNoteFlag = (oPropertyUpdated.isUpdateNote) ? "X" : "";

				this._doUpdateReasonCodeAndNote(aDisputeDatas, sPayAmountFlag, sReasonFlag, sNoteFlag);
				break;
			case "attachment":
				var oUploadCollections = this.byId(this.getView().createId("idAttachmentUploadColec"));
				if (oUploadCollections.getItems().length) {
					oUploadCollections.upload();
				}
				break;
			default:
				return;
			}
		},

		onTabToolBarUpdateAndNote: function () {
			var aDisputes = this.byId("idDisputeDetailTab").getSelectedItems();
			if (aDisputes.length === 0) {
				MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
				return;
			}
			// Check status is Approved or Denied
			for (var i = 0; i < aDisputes.length; i++) {
				var oData = aDisputes[i].getBindingContext().getObject();
				if (oData.Status === "A" || oData.Status === "DN") {
					MessageBox.error(this.oBundle.getText("errorSelectApproDeniedItemMsg", oData.Trackpro));
					return;
				}
			}
			// If user select more than 1 tracking no, does not allow attachment upload
			var oPropertyUpdate = {
				isDisplayCheckbox: false,
				isUpdateReaCode: true,
				isUpdateDisputeAmt: true,
				isUpdateNote: true
			};
			if (aDisputes.length > 1) {
				this.getModel("local").setProperty("/uploadAttachmentEnabled", false);
				// Update multiple item
				oPropertyUpdate.selectedAll = true;
				oPropertyUpdate.isDisplayCheckbox = true;
			} else {
				// If user select only 1 tracking no, allow attachment upload
				this.getModel("local").setProperty("/uploadAttachmentEnabled", true);

			}
			this.getModel("local").setProperty("/propertyUpdated", oPropertyUpdate);

			var sPath = aDisputes[0].getBindingContext().getPath();
			var bGetNote = false;
			var aReasonCodeList = this.getModel("local").getProperty("/reasonCodeList");
			if (aReasonCodeList.length > 0) {
				var oSelectedDispute = aDisputes[0].getBindingContext().getObject();
				oSelectedDispute.ChargeCode = oSelectedDispute.ChargeCode || aReasonCodeList[0].Code;
				if (aDisputes.length > 1) {
					oSelectedDispute.ChargeCode = aReasonCodeList[0].Code;
					oSelectedDispute.Note = "";
					oSelectedDispute.DisputeAmt = "0";
				} else {
					// get note
					bGetNote = true;
					var fnSuccess = function (oReturnData) {
						this.getModel("local").setProperty("/selectedDisputeDetail/Note", oReturnData.Text);
						this.hideBusy();
					}.bind(this);
					this._getDtlNotes("'" + oSelectedDispute.DisputeID + "'", "'" + oSelectedDispute.Trackpro + "'", "'ZDCC'", fnSuccess);
				}
				this.getModel("local").setProperty("/selectedDisputeDetail", oSelectedDispute);
				this.oUpdateReasonAndNoteDialog = Utils.getFragment(null, "UpdateReasonAndNote", this);
				this.byId("idIconTabBarUpdateReCod").setSelectedKey("info");
				this.byId("btnUpdate").setVisible(true);
				this.byId("btnUpload").setVisible(false);

				this.oUpdateReasonAndNoteDialog.bindElement(sPath);
				this.oAttachmentsControl = this.byId(this.getView().createId("idAttachmentUploadColec"));
				this.oUpdateReasonAndNoteDialog.open();
				this.oAttachmentsControl.getBinding("items").attachDataReceived(this.onAttachmentsLoadingDone.bind(this, this.oAttachmentsControl));
				this.oAttachmentsControl.getBinding("items").refresh();

				if (bGetNote) {
					this.showBusy();
				}
			} else {
				var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
				var sMsg = this.oBundle.getText("msNoReasonCode");
				MessageBox.information(
					sMsg, {
						styleClass: bCompact ? "sapUiSizeCompact" : ""
					}
				);
			}
		},

		onAttachmentsLoadingDone: function (oUploadControl) {
			// Handle attachment delete (because current SAPUI5 version: 1.40 doesn't support event "deletePress" on "UploadCollectionItem")
			for (var i = 0; i < oUploadControl.getItems().length; i++) {
				var sServiceURL = oUploadControl.getItems()[i].getModel().sServiceUrl;
				var thisItemBindingPath = oUploadControl.getItems()[i].getBindingContext().getPath();
				oUploadControl.getItems()[i].setUrl(sServiceURL + thisItemBindingPath + "/$value");
			}
		},

		onDeleteAttachment: function (oEvent) {
			var uploadIds = oEvent.getSource().data("uploadId");
			var oAttachmentsControl = this.byId(this.getView().createId(uploadIds));
			// If no file is selected, return
			if (!oAttachmentsControl.getSelectedItem()) {
				MessageBox.warning(this.oBundle.getText("noDtlSelectAttaDelete"));
				return;
			}

			if (oAttachmentsControl.getSelectedItem()._status === "pendingUploadStatus") {
				oAttachmentsControl.removeItem(oAttachmentsControl.getSelectedItem());
				return;
			}

			var sTitle = this.oBundle.getText("detailConfirmDeleteTitle");
			var sMsg = this.oBundle.getText("detailConfirmDeleteAttachmentMsg");
			var sDeletedFileName = oAttachmentsControl.getSelectedItem().getFileName();
			var sPath = oAttachmentsControl.getSelectedItem().getBindingContext().getPath();
			var oSelectedTrackPro = this.getModel("local").getProperty("/selectedDisputeDetail");
			sMsg = sMsg + " " + sDeletedFileName + " ?";

			MessageBox.confirm(sMsg, {
				title: sTitle,
				actions: [
					sap.m.MessageBox.Action.YES,
					sap.m.MessageBox.Action.NO
				],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._deleteAttachment(oAttachmentsControl, sPath, oSelectedTrackPro.DisputeID, oSelectedTrackPro.Trackpro);
					}
				}.bind(this)
			});
		},

		onUploadFiles: function () {
			var oUploadCollection = this.byId("idAttachmentUploadColec");
			var cFiles = oUploadCollection.getItems();
			var oFile;
			var bUpload = false;
			for (var i = 0; i < cFiles.length; i++) {
				oFile = cFiles[i];
				if (oFile._status === "pendingUploadStatus") {
					bUpload = true;
					break;
				}
			}
			if (bUpload) {
				this.showBusy();
				oUploadCollection.upload();
			} else {
				MessageBox.warning(this.oBundle.getText("noDtlSelectAtta"));
				return;
			}
		},

		onStatusUploadFiles: function () {
			var oUploadCollection = this.byId("idStatusUploadFile");
			var cFiles = oUploadCollection.getItems();
			var oFile;
			var bUpload = false;
			for (var i = 0; i < cFiles.length; i++) {
				oFile = cFiles[i];
				if (oFile._status === "pendingUploadStatus") {
					bUpload = true;
					break;
				}
			}
			if (bUpload) {
				this.showBusy();
				oUploadCollection.upload();
			} else {
				MessageBox.warning(this.oBundle.getText("noDtlSelectAtta"));
				return;
			}
		},

		onBeforeUpload: function (oEvent) {
			var oControl = oEvent.getSource();
			var objectType = oControl.data("objectType");

			var oItem = this.getModel("local").getProperty("/selectedDisputeDetail");
			var sSlug = oItem.DisputeID + "|" + oItem.Trackpro + "|" + objectType + "|" + oEvent.getParameter("fileName") +
				"|" + "6";
			var headerParma = new UploadCollectionParameter({
				name: "slug",
				value: sSlug
			});
			oEvent.getParameters().addHeaderParameter(headerParma);
		},

		onUploadChange: function (oEvent) {
			var sCsrfToken = this.getModel().getSecurityToken();
			var oUploadCollection = oEvent.getSource();
			var headerParma = new UploadCollectionParameter({
				name: "x-csrf-token",
				value: sCsrfToken
			});
			oUploadCollection.addHeaderParameter(headerParma);
		},

		onUploadComplete: function (oEvent) {
			var oStatus = oEvent.getParameter("status");
			if (oStatus === 200) {
				MessageToast.show(this.oBundle.getText("sbUploadSuccess"));
			}
			oEvent.getSource().getBinding("items").refresh();
			this.byId("idDisputeDetailTab").getBinding("items").refresh();
			this.hideBusy();
		},

		onChangeCodeClose: function () {
			this.oUpdateReasonAndNoteDialog.close();
		},

		onTabToolBarSplitMerge: function () {
			var aDisputes = this.byId("idDisputeDetailTab").getSelectedItems();
			if (aDisputes.length === 0) {
				MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
				return;
			}
			var fnGetDisputeListSucc = function (oData) {
				this.getView().getElementBinding().refresh();
				for (var i = 0; i < oData.results.length; i++) {
					if (oData.results[i].ID === this.getView().getBindingContext().getObject().ID) {
						oData.results.splice(i, 1);
						break;
					}
				}
				this.getModel("local").setProperty("/disputeConsolList", oData.results);
				this.oDisputeConsolListDialog = Utils.getFragment(null, "DisputeConsolListDialog", this);
				this.oDisputeConsolListDialog.open();
				this.hideBusy();
			}.bind(this);
			var fnGetDisputeListErr = function (oError) {
				this._handleODataError(oError);
				this.hideBusy();
			}.bind(this);
			this.showBusy();
			this._getDisputeList(fnGetDisputeListSucc, fnGetDisputeListErr);
		},

		onDisputeConsolListSearch: function (oEvent) {
			var sValue = oEvent.getSource().getValue("value");
			var oFilter = new Filter("ID", sap.ui.model.FilterOperator.Contains, sValue);
			var oView = this.getView();
			var oBinding = sap.ui.getCore().byId(oView.createId("tbDisputeConsolList")).getBinding("items");
			oBinding.filter([oFilter]);
		},

		onDisputeMerge: function () {
			var aDisputes = this.byId("idDisputeDetailTab").getSelectedItems();
			var oConsolTab = this.byId(this.getView().createId("tbDisputeConsolList"));
			var aItems = oConsolTab.getSelectedItems();
			if (aItems.length === 0) {
				return;
			}
			var sPath = aItems[0].getBindingContextPath();
			var oData = this.getModel("local").getProperty(sPath);
			var sNewConsolId = oData.ID;
			this._merge(aDisputes, sNewConsolId);
		},

		onDisputeSplit: function () {
			var aDisputes = this.byId("idDisputeDetailTab").getSelectedItems();
			this._split(aDisputes);
		},

		onDisputeSplitMergeDialogCancel: function () {
			this.oDisputeConsolListDialog.close();
		},

		onTabToolBarReset: function () {
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			var aDisputes = this.byId("idDisputeDetailTab").getSelectedItems();
			var sMsg = this.oBundle.getText("detailConfirmResetMsg");
			var sTitle = this.oBundle.getText("detailConfirmResetTitle");
			if (aDisputes.length === 0) {
				MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
				return;
			}
			MessageBox.confirm(sMsg, {
				title: sTitle,
				actions: [
					sap.m.MessageBox.Action.YES,
					sap.m.MessageBox.Action.NO
				],
				initialFocus: sap.m.MessageBox.Action.YES,
				styleClass: bCompact ? "sapUiSizeCompact" : "",
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this._reset(aDisputes);
					}
				}.bind(this)
			});
		},

		onTabToolBarDeleteLine: function () {
			this.deletedListDialog = Utils.getFragment(null, "DeletedListDispute", this);
			var oTable = this.deletedListDialog.getContent()[0].getContent()[0];
			oTable.getBinding("items").refresh(true);
			this.deletedListDialog.open();
		},

		onDeleteListDialogClose: function () {
			this.deletedListDialog.close();
		},

		onTabToolBarDelete: function () {
			var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
			var aInvoices = this.byId("idDisputeDetailTab").getSelectedItems();
			var sMsg = this.oBundle.getText("detailConfirmDeleteMsg");
			var sTitle = this.oBundle.getText("detailConfirmDeleteTitle");
			if (aInvoices.length === 0) {
				MessageBox.error(this.oBundle.getText("noDtlSelectMsg"));
				return;
			}
			MessageBox.confirm(sMsg, {
				title: sTitle,
				actions: [
					sap.m.MessageBox.Action.YES,
					sap.m.MessageBox.Action.NO
				],
				initialFocus: sap.m.MessageBox.Action.YES,
				styleClass: bCompact ? "sapUiSizeCompact" : "",
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						var aDisputes = this.byId("idDisputeDetailTab").getSelectedItems();
						this._deleteDispute(aDisputes);
					}
				}.bind(this)
			});
		},

		fnBeforeCloseCreditDialog: function () {
			var oInput = this.byId(this.getView().createId("idCreditAmountInput"));
			oInput.setValueState("None");
		},

		getReasonCodeDescription: function (sChargeCode) {
			try {
				var aDatas = this.getModel("local").getProperty("/reasonCodeList");

				for (var i = 0; i < aDatas.length; i++) {
					if (aDatas[i].Code === sChargeCode) {
						return aDatas[i].Description;
					}
				}
			} catch (exc) {
				return "";
			}
			return "";
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			this.showBusy();
			var sDisputeID = oEvent.getParameter("arguments").DisputeID;
			this.getModel("local").setProperty("/id", sDisputeID);
			this.getModel().metadataLoaded().then(function () {
				var sObjectPath = this.getModel().createKey("xSERPERPxI_DPHDR", {
					ID: sDisputeID
				});
				this._bindView("/" + sObjectPath);
			}.bind(this));
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function (sObjectPath) {
			var that = this;
			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function () {},
					dataReceived: function (oResult) {
						var data = oResult.getParameter("data");
						// In case didn't receive any data
						if (!data) {
							that.oNoDisputeDetailDialog = Utils.getFragment(null, "DisputeDetailNoDataDialog", that);
							that.oNoDisputeDetailDialog.open();
						}

						// Load resoan code
						var oView = this.getView();
						if (oView.getBindingContext()) {
							var oDisputeData = oView.getBindingContext().getObject();
							this.getModel("local").setProperty("/Status", oDisputeData.Status);
							this.sCoCode = oDisputeData.CompanyCode;
							// Get reason code.
							this.getModel().read("/xSERPERPxI_DPRSN", {
								filters: [new Filter({
									path: "CompanyCode",
									operator: FilterOperator.EQ,
									value1: this.sCoCode
								})],
								success: function (oData) {
									this.getModel("local").setProperty("/reasonCodeList", oData.results);
								}.bind(this),
								error: function (oError) {
									this._handleODataError(oError);
								}.bind(this)
							});
						}
					}.bind(this)
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();
			if (oView.getBindingContext()) {
				this.getModel("local").setProperty("/Status", oView.getBindingContext().getObject().Status);
			}
			oElementBinding.refresh();
			this.getView().byId("idDisputeDetailTab").getBinding("items").refresh();

		},

		_doPostOrEDIOrPrintOrSendEmailDispute: function (sAction, sStatus) {
			this.showBusy();
			if (sStatus === undefined) {
				sStatus = "X";
			}
			var oDispute = this.getView().getBindingContext().getObject();
			this.getModel().callFunction("/ProcessDisputeHeader", {
				method: "POST",
				urlParameters: {
					ID: oDispute.ID,
					Action: sAction,
					UpdateStatus: sStatus
				},
				success: function () {
					// REFRESH Table Control
					this.getView().getElementBinding().refresh();
					this.byId("idDisputeDetailTab").getBinding("items").refresh();
					var sSuccessMsg = "";
					switch (sAction) {
					case "POST":
						sSuccessMsg = this.oBundle.getText("msbPostTitleSucess");
						break;
					case "EDI":
						sSuccessMsg = this.oBundle.getText("msbEDITitleSucess");
						break;
					case "PRINT":
						sSuccessMsg = this.oBundle.getText("msbPrintTitleSucess");
						break;
					case "EMAIL":
						sSuccessMsg = this.oBundle.getText("msbEmailTitleSucess");
						break;
					}
					MessageToast.show(sSuccessMsg);
				}.bind(this),
				error: this._errorHandle.bind(this)
			});

		},

		_deleteDispute: function (aDisputes) {
			this.showBusy();
			var oDispute;
			for (var i = 0; i < aDisputes.length; i++) {
				oDispute = aDisputes[i].getBindingContext().getObject();
				this.getModel().callFunction("/DeleteItem", {
					method: "POST",
					urlParameters: {
						ID: oDispute.DisputeID,
						TrackingNo: oDispute.Trackpro
					},
					groupId: "DisputeDtlMassDelete",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "DisputeDtlMassDelete",
				success: function (oData) {
					if (!this._handleBatchResponseHasError(oData)) {
						// If not show success message
						MessageToast.show(this.oBundle.getText("sbDeleteSuccess"));
					}
					// REFRESH Table Control
					this.byId("idDisputeDetailTab").getBinding("items").refresh();
					this.getView().getElementBinding().refresh();
				}.bind(this),
				error: this._errorHandle.bind(this)
			});
		},

		_errorHandle: function (oError) {
			this.byId("idDisputeDetailTab").getBinding("items").refresh();
			this._handleODataError(oError);
			this.hideBusy();
		},

		_updateItemStatus: function (aDisputes, sUpdatedStatus, sNote) {
			this.showBusy();
			var oDispute;
			for (var i = 0; i < aDisputes.length; i++) {
				oDispute = aDisputes[i].getBindingContext().getObject();
				this.getModel().callFunction("/UpdItemStatus", {
					method: "POST",
					urlParameters: {
						ID: oDispute.DisputeID,
						Status: sUpdatedStatus,
						TrackingNo: oDispute.Trackpro,
						Notes: sNote
					},
					groupId: "DisputeDtlMassUpdateStatus",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "DisputeDtlMassUpdateStatus",
				success: function (oData) {
					if (!this._handleBatchResponseHasError(oData)) {
						//1.1 If not show success message
						MessageToast.show(this.oBundle.getText("sbUpdateSuccess"));
					}
					// REFRESH Table Control
					this.getView().getElementBinding().refresh();
					this.byId("idDisputeDetailTab").getBinding("items").refresh();
					this.updateStatusDialog.close();
				}.bind(this)
			});
		},

		_toInprocess: function (oDispute, sStatus) {
			this.showBusy();
			this.getModel().callFunction("/CompleteNRevert", {
				method: "POST",
				urlParameters: {
					ID: oDispute.ID,
					Status: sStatus
				},
				success: function () {
					// REFRESH Table Control
					this.byId("idDisputeDetailTab").getBinding("items").refresh();
					this.getView().getElementBinding().refresh();
					var sMsgKey = "";
					this.getModel("local").setProperty("/Status", sStatus);
					if (sStatus === "C") {
						sMsgKey = "sbSetCompleteSuccess";
					} else {
						sMsgKey = "sbReverIPSuccess";
					}
					MessageToast.show(this.oBundle.getText(sMsgKey));
				}.bind(this),
				error: this._errorHandle.bind(this)
			});
		},

		_reset: function (aDisputes) {
			this.showBusy();
			var oDispute;
			for (var i = 0; i < aDisputes.length; i++) {
				oDispute = aDisputes[i].getBindingContext().getObject();
				this.getModel().callFunction("/ResetItem", {
					method: "POST",
					urlParameters: {
						ID: oDispute.DisputeID,
						TrackingNo: oDispute.Trackpro
					},
					groupId: "DisputeDtlMassReset",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "DisputeDtlMassReset",
				success: function (oData) {
					if (!this._handleBatchResponseHasError(oData)) {
						// If not show success message
						MessageToast.show(this.oBundle.getText("sbRestSuccess"));
					}
					// REFRESH Table Control
					this.byId("idDisputeDetailTab").getBinding("items").refresh();
				}.bind(this),
				error: this._errorHandle.bind(this)
			});
		},

		_split: function (aDisputes) {
			this.showBusy();
			var oDispute;
			for (var i = 0; i < aDisputes.length; i++) {
				oDispute = aDisputes[i].getBindingContext().getObject();
				this.getModel().callFunction("/SplitItem", {
					method: "POST",
					urlParameters: {
						ID: oDispute.DisputeID,
						TrackingNo: oDispute.Trackpro
					},
					groupId: "DisputeDtlMassSplit",
					changeSetId: "split"
				});
			}
			this.getModel().submitChanges({
				groupId: "DisputeDtlMassSplit",
				success: function (oData) {
					if (!this._handleBatchResponseHasError(oData)) {
						// REFRESH Table Control
						this.byId("idDisputeDetailTab").getBinding("items").refresh();
						this.getView().getElementBinding().refresh();
						this.oDisputeConsolListDialog.close();
						this._gotoNewItem(oData.__batchResponses[0].__changeResponses[0].data.ID);
					} else {
						this.hideBusy();
					}
				}.bind(this)
			});
		},

		_merge: function (aDisputes, sNewID) {
			this.showBusy();
			var oDispute;
			for (var i = 0; i < aDisputes.length; i++) {
				oDispute = aDisputes[i].getBindingContext().getObject();
				this.getModel().callFunction("/MergeItem", {
					method: "POST",
					urlParameters: {
						ID: oDispute.DisputeID,
						NewID: sNewID,
						TrackingNo: oDispute.Trackpro
					},
					groupId: "DisputeDtlMassMerge",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "DisputeDtlMassMerge",
				success: function (oData) {
					if (!this._handleBatchResponseHasError(oData)) {
						// REFRESH Table Control
						this.byId("idDisputeDetailTab").getBinding("items").refresh();
						this.getView().getElementBinding().refresh();
						this.oDisputeConsolListDialog.close();
						this._gotoNewItem(sNewID);
					} else {
						this.hideBusy();
					}
				}.bind(this)
			});
		},
		_doUpdateReasonCodeAndNote: function (aTrackingToBeUpdated, sPayAmountFlag, sReasonFlag, sNoteFlag) {
			this.showBusy();
			for (var i = 0; i < aTrackingToBeUpdated.length; i++) {
				var oTrackingToBeUpdated = aTrackingToBeUpdated[i];
				this.getModel().callFunction("/UpdItemRCAN", {
					"method": "POST",
					urlParameters: {
						ID: oTrackingToBeUpdated.DisputeID,
						TrackingNo: oTrackingToBeUpdated.Trackpro,
						ChargeCode: oTrackingToBeUpdated.ChargeCode,
						DisputeAmount: oTrackingToBeUpdated.DisputeAmt,
						Notes: oTrackingToBeUpdated.Note,
						PayAmountFlag: sPayAmountFlag,
						ReasonFlag: sReasonFlag,
						NoteFlag: sNoteFlag
					},
					groupId: "DisputeDtlMassReasonNote",
					changeSetId: i + ""
				});
			}
			this.getModel().submitChanges({
				groupId: "DisputeDtlMassReasonNote",
				success: function (oData) {
					if (!this._handleBatchResponseHasError(oData)) {
						// If not show success message
						MessageToast.show(this.oBundle.getText("msbUpdateReasonCodeAndNoteTitleSucess"));
					}
					// REFRESH Table Control
					this.byId("idDisputeDetailTab").getBinding("items").refresh();
					this.oUpdateReasonAndNoteDialog.close();
				}.bind(this),
				error: this._errorHandle.bind(this)
			});
		},

		_updateCredit: function (oDispute, sCreditAmount) {
			this.showBusy();
			this.getModel().callFunction("/SetCreditAmount", {
				method: "POST",
				urlParameters: {
					ID: oDispute.DisputeID,
					TrackingNo: oDispute.Trackpro,
					CreditAmount: sCreditAmount
				},
				success: function () {
					// REFRESH Table Control
					this.byId("idDisputeDetailTab").getBinding("items").refresh();
					this.getView().getElementBinding().refresh();
					MessageToast.show(this.oBundle.getText("msbUpdateCreditAmtSucess"));
					this.oCreditAmtDialog.close();
				}.bind(this),
				error: function (oError) {
					this.byId("idDisputeDetailTab").getBinding("items").refresh();
					this._handleODataError(oError);
					this.oCreditAmtDialog.close();
				}.bind(this)
			});
		},

		_getDisputeList: function (fnSucess, fnError) {
			var oModel = this.getModel();
			var oData = this.getView().getBindingContext().getObject();
			oModel.callFunction("/GetDisputeConsolList", {
				method: "GET",
				urlParameters: {
					Carrier: oData.CarrierCode,
					Vendor: oData.Vendor,
					CoCode: oData.CompanyCode,
					Invoice: oData.InvoiceNo,
					Account: oData.AccountNo
				},
				success: fnSucess,
				error: fnError
			});
		},

		_gotoNewItem: function (sDisputeID) {
			var sMsg = this.oBundle.getText("msgGotoNewDispute", [sDisputeID]);
			MessageBox.confirm(sMsg, {
				actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
				initialFocus: sap.m.MessageBox.Action.YES,
				onClose: function (oAction) {
					if (oAction === MessageBox.Action.YES) {
						this.getRouter().navTo("disputeDetail", {
							DisputeID: sDisputeID
						}, true);
					}
				}.bind(this)
			});
		},

		_getDtlNotes: function (sDisputeID, sTrackingNo, sTextId, fnSuccess) {
			this.getModel().read("/GetDtlNotes", {
				method: "GET",
				urlParameters: {
					DisputeID: sDisputeID,
					TrackingNo: sTrackingNo,
					TextID: sTextId
				},
				success: fnSuccess,
				error: function (oError) {
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		},

		_deleteAttachment: function (oUploadControl, sPath, sDisputeID, sTrackPro) {
			this.showBusy();
			this.getModel().setHeaders({
				"disputeid": sDisputeID,
				"trackpro": sTrackPro
			});
			this.getModel().remove(sPath, {
				success: function () {
					oUploadControl.getBinding("items").refresh();
					this.byId("idDisputeDetailTab").getBinding("items").refresh();
					MessageToast.show(this.oBundle.getText("detailDeleteAttachmentSuccessMsg"));
					this.hideBusy();
				}.bind(this),
				error: function (oError) {
					oUploadControl.getBinding("items").refresh();
					this.byId("idDisputeDetailTab").getBinding("items").refresh();
					this._handleODataError(oError);
					this.hideBusy();
				}.bind(this)
			});
		}
	});
});