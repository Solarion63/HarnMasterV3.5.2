function renderRoot(application, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return application.element ?? null;
}

function filePickerClass() {
  const candidate = foundry.applications.apps.FilePicker;
  return candidate?.implementation ?? candidate ?? globalThis.FilePicker ?? null;
}

async function chooseDocumentImage(application) {
  const document = application.document ?? application.actor ?? application.item;
  if (!document || !application.isEditable) return null;

  const FilePickerClass = filePickerClass();
  if (!FilePickerClass) {
    ui.notifications.error("The Foundry image browser is unavailable.");
    console.error("HM3 | No Foundry FilePicker implementation was available.");
    return null;
  }

  const picker = new FilePickerClass({
    type: "image",
    current: document.img,
    callback: async path => {
      if (!path || path === document.img) return;
      await document.update({ img: path });
      application.render({ force: true });
    },
    top: Math.max(Number(application.position?.top) || 0, 0) + 40,
    left: Math.max(Number(application.position?.left) || 0, 0) + 20
  });

  return picker.browse();
}

function bindImagePicker(application, html) {
  if (!application.isEditable) return;

  const root = renderRoot(application, html);
  if (!root) return;

  for (const image of root.querySelectorAll("img[data-edit='img'], img.profile-img")) {
    if (image.dataset.hm3ImagePickerBound === "1") continue;

    image.classList.add("hm3-image-picker");
    image.setAttribute("role", "button");
    image.setAttribute("tabindex", "0");
    image.setAttribute("aria-label", `Choose image for ${application.document?.name ?? "document"}`);

    const openPicker = event => {
      event.preventDefault();
      event.stopPropagation();
      chooseDocumentImage(application).catch(error => {
        console.error("HM3 | Image selection failed", error);
        ui.notifications.error("Image selection failed. See the console for details.");
      });
    };

    image.addEventListener("click", openPicker);
    image.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key)) return;
      openPicker(event);
    });
    image.dataset.hm3ImagePickerBound = "1";
  }
}

const hooks = [
  "renderHarnMasterCharacterSheetV2",
  "renderHarnMasterCreatureSheetV2",
  "renderHarnMasterContainerSheetV2",
  "renderHarnMasterSkillItemSheetV2",
  "renderHarnMasterSpellItemSheetV2",
  "renderHarnMasterInvocationItemSheetV2",
  "renderHarnMasterPsionicItemSheetV2",
  "renderHarnMasterWeapongearItemSheetV2",
  "renderHarnMasterContainergearItemSheetV2",
  "renderHarnMasterMissilegearItemSheetV2",
  "renderHarnMasterArmorgearItemSheetV2",
  "renderHarnMasterMiscgearItemSheetV2",
  "renderHarnMasterInjuryItemSheetV2",
  "renderHarnMasterArmorlocationItemSheetV2",
  "renderHarnMasterTraitItemSheetV2"
];

for (const hook of hooks) {
  Hooks.on(hook, bindImagePicker);
}
