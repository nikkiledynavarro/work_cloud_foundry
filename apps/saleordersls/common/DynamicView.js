sap.ui.define(["sap/ui/layout/form/SimpleForm", "com/erpis/shiperp/sls/salesordersls/common/ControlUtils",
	"com/erpis/shiperp/sls/salesordersls/common/Utils"
], function (SimpleForm, ControlUtils, Utils) {
	"use strict";
	return {
		/**Render dynamic fields for more option view
		 * */
		renderMoreOptionForm: function (aSourceFields, oController) {
			if (aSourceFields.length > 0) {
				var oMoreOptionForm = this.renderMoreOptionFormContent(aSourceFields, oController, false);
				oController.oMoreOptionDialog.addContent(oMoreOptionForm);
			}
		},
		renderMoreOptionFormContent: function (aOriginalSourceFields, oController, bDeep) {
			var aRootFields = Utils._getExistItemsArray(aOriginalSourceFields, "FieldPName", "");
			var aSourceFields = Utils._removeDuplicateObjInArr(aRootFields, "FieldName"); //remove duplicate record prevent dup items on UI
			//check deep items
			if (bDeep === true) {
				aSourceFields = aOriginalSourceFields;
			}
			if (aSourceFields.length > 0) {
				var oMoreOptionForm = new SimpleForm({
					width: "auto",
					editable: true,
					layout: "ResponsiveGridLayout",
					labelSpanXL: 6,
					labelSpanL: 6,
					labelSpanM: 6,
					labelSpanS: 4,
					columnsXL: 4,
					columnsL: 4,
					columnsM: 3
				}).addStyleClass("border_lightgray sapUiSmallMarginBottom");
				var sFieldGroup = "";
				for (var i = 0; i < aSourceFields.length; i++) {
					if (aSourceFields[i].FieldGroup !== sFieldGroup && aSourceFields[i].Sequence === "01") {
						var oTitle = new sap.ui.core.Title({
							text: aSourceFields[i].GroupText
						});
						oMoreOptionForm.addContent(oTitle);
						sFieldGroup = aSourceFields[i].FieldGroup;
					}
					if (aSourceFields[i].CarrCode === "" || aSourceFields[i].FieldName === "") {
						continue;
					}
					var oLabel = ControlUtils.Label(aSourceFields[i].FieldDesc);
					if (aSourceFields[i].FieldType !== "08") {
						oMoreOptionForm.addContent(oLabel);
					}

					//Build dynamic fields
					var thisInstance = this;
					var oSourceField = Object.assign({}, aSourceFields[i]);
					oSourceField.MoreOptionItemSet = (aSourceFields[i].MoreOptionItemSet) ? aSourceFields[i].MoreOptionItemSet.results : []; //set data for combobox
					//Add event for checkbox if FieldValue2 not null
					if (aSourceFields[i].FieldType === "02" && aSourceFields[i].FieldValue2 !== "") {
						//add checkbox event to enable disable button
					}
					//Field type button event handler
					if (aSourceFields[i].FieldType === "08") {
						oSourceField.FnCallback = function (data) {
							var aDeepFields = Utils._getExistItemsArray(aOriginalSourceFields, "FieldPName", data.key);
							if (aDeepFields.length > 0) {
								var aSourceDeepFields = Utils._removeDuplicateObjInArr(aDeepFields, "FieldName"); //remove duplicate record prevent dup items on UI
								var oMoreOptionChild = thisInstance.renderMoreOptionFormContent(aSourceDeepFields, oController, true);
								thisInstance.renderDialog(oMoreOptionChild, data.key, data.text, oController, thisInstance);
							}
						};
					}

					var oFieldBase = ControlUtils.BuildControlByType(oSourceField, oController);
					// Disable option before add to content
					if (aSourceFields[i].DisplayOption === "1" || aSourceFields[i].DisplayOption === "2") {
						if (aSourceFields[i].DisplayOption === "2") {
							oLabel.setRequired(true);
						} else {
							oLabel.setRequired(false);
						}
						oFieldBase.setEnabled(true);
					} else {
						oFieldBase.setEnabled(false);
					}
					oFieldBase.setWidth("auto");
					oMoreOptionForm.addContent(oFieldBase);
				} //end loop

				return oMoreOptionForm;
			}
			return null;
		},
		renderDialog: function (oContent, deepId, sTitle, oController, oDynamicInstance) {

			//remove old dialog to avoid duplicate
			if (oController._deepFormDialog) {
				oController._deepFormDialog.destroy();
				oController._deepFormDialog = null;
			}
			//create new dialog
			oController._deepFormDialog = new sap.m.Dialog({
				id: deepId,
				title: sTitle,
				content: oContent,
				state: "Success",
				stretch: true,
				endButton: new sap.m.Button({
					text: "Cancel",
					press: function () {
						if (oController._deepFormDialog.getContent()[0]) {
							oDynamicInstance.getDynamicDataForDialog(oController._deepFormDialog, oController, oDynamicInstance, false);
						}
						oController._deepFormDialog.close();
						oController._deepFormDialog.destroy();
					}
				})
			});
			oController.getView().addDependent(oController._deepFormDialog);
			oController._deepFormDialog.open();

		},
		getDynamicDataForDialog: function (oDialogInstance, oController, oDynamicInstance, isDeep) {

			if (oDialogInstance === null) {
				return;
			}
			if (oDialogInstance.getContent()[0]) {
				var aControls = oDialogInstance.getContent()[0].getContent();
				if (aControls.length > 0) {
					//set common more option
					var sPath = oController.getView().getBindingContext("global").getPath();
					var oObject = oController.getView().getBindingContext("global").getObject();
					//set moreoption for shipset
					for (var i = 0; i < aControls.length; i++) {
						if (!(aControls[i] instanceof sap.m.Button || aControls[i] instanceof sap.m.Label || aControls[i] instanceof sap.ui.core.Title)) {
							// Update Saturday Delivery Indicator
							if (aControls[i].getId() === "SATURDAYDELIV") {
								oObject.Satdeliv = aControls[i].getSelected();
							} else if (aControls[i].getId() === "CARRIERRESID") {
								// Update Saturday Delivery Indicator
								oObject.Resident = aControls[i].getSelected();
							}
							oDynamicInstance._getDataFromDynamicControl(aControls[i], oObject);
							

						}
					}
					oController.getModel("global").setProperty(sPath, oObject);
				}
			}
		},
		_getDataFromDynamicControl: function (oControl, oSource) {
			var sFieldName = oControl.getId(),
				sValue1 = "",
				sValue2 = "";
			if (oControl instanceof sap.m.CheckBox) {
				sValue1 = oControl.getSelected() ? "X" : "";
			} else if (oControl instanceof sap.m.ComboBox) {
				sValue1 = oControl.getSelectedKey();
			} else if (oControl instanceof sap.m.Input) {
				sValue1 = oControl.getValue();
			} else if (oControl instanceof sap.m.DateRangeSelection) {
				var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "yyyyMMdd"
				});
				sValue1 = dateFormat.format(oControl.getDateValue());
				sValue2 = dateFormat.format(oControl.getSecondDateValue());
			} else if (oControl instanceof sap.m.DatePicker) {
				sValue1 = oControl.getValue();
			} else if (oControl instanceof sap.m.RadioButton) {
				sValue1 = oControl.getSelected();
			} else if (oControl instanceof sap.m.TimePicker) {
				sValue1 = oControl.getValue();
			}
			this._updateMoreOptionData(oSource, sFieldName, sValue1, sValue2);
		},
		_updateMoreOptionData: function (oSource, sFieldName, sValue1, sValue2) {
				if (!sFieldName) {
					return;
				}
				if(!oSource.MoreOptionSet.results){
					return;
				}
				for (var i = 0; i < oSource.MoreOptionSet.results.length; i++) {
					if (oSource.MoreOptionSet.results[i].FieldName === sFieldName) {
						oSource.MoreOptionSet.results[i].FieldValue = sValue1;
						oSource.MoreOptionSet.results[i].FieldValue02 = sValue2;
						break;
					}
				}
			} //end

	};
});