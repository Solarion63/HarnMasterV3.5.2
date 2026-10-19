function filePickerClass() {
  const candidate = foundry.applications.apps.FilePicker;
  return candidate?.implementation ?? candidate ?? globalThis.FilePicker ?? null;
}

function imageField(image) {
  return image.dataset.edit || "img";
}

function currentImage(document, field, image) {
  return foundry.utils.getProperty(document, field) || image.currentSrc || image.src || document.img;
}

async function chooseDocumentImage(application, image) {
  const document = application.document ?? application.actor ?? application.item;
  if (!document || !application.isEditable) return null;

  const FilePickerClass = filePickerClass();
  if (!FilePickerClass) {
    ui.notifications.error("The Foundry image browser is unavailable.");
    console.error("HM3 | No Foundry FilePicker implementation was available.");
    return null;
  }

  const field = imageField(image);
  const current = currentImage(document, field, image);
  const picker = new FilePickerClass({
    type: "image",
    current,
    callback: async path => {
      if (!path || path === current) return;
      await document.update({ [field]: path });
      application.render({ force: true });
    },
    top: Math.max(Number(application.position?.top) || 0, 0) + 40,
    left: Math.max(Number(application.position?.left) || 0, 0) + 20
  });

  return picker.browse();
}

/**
 * Bind the shared HM3 image picker to image controls in an ApplicationV2
 * document sheet.
 *
 * @param {object} application The ActorSheetV2 or ItemSheetV2 instance.
 * @param {HTMLElement} root The rendered sheet root.
 */
export function bindDocumentImagePicker(application, root) {
  if (!application.isEditable || !root) return;

  for (const image of root.querySelectorAll("img[data-edit], img.profile-img")) {
    image.classList.add("hm3-image-picker");
    image.setAttribute("role", "button");
    image.setAttribute("tabindex", "0");
    image.setAttribute("aria-label", `Choose image for ${application.document?.name ?? "document"}`);

    const openPicker = event => {
      event.preventDefault();
      event.stopPropagation();
      chooseDocumentImage(application, image).catch(error => {
        console.error("HM3 | Image selection failed", error);
        ui.notifications.error("Image selection failed. See the console for details.");
      });
    };

    image.addEventListener("click", openPicker);
    image.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key)) return;
      openPicker(event);
    });
  }
}
