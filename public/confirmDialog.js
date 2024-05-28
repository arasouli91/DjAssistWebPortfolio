import { buildGetRequest, extractFileName, bindDataToDOMElements } from './util.js';

function createRatingBar(modalContentElement) {
  let selectedValue = 0;
  
  // Create the container for the rating bar
  const ratingBar = document.createElement('div');
  ratingBar.id = 'rating-bar';
  ratingBar.className = 'd-flex justify-content-between';
  
  // Function to highlight cells up to a specified value
  function highlightCellsUpTo(value) {
    for (let i = 0; i <= 10; i++) {
      const cell = ratingBar.children[i];
      if (i <= value) {
        cell.classList.add('hovered');
      } else {
        cell.classList.remove('hovered');
      }
    }
  }

  // Create a "0" cell
  const zeroCell = document.createElement('div');
  zeroCell.className = 'rating-cell';
  zeroCell.dataset.value = '0';
  zeroCell.textContent = '0'; // Add text to indicate this is the "0" option
  ratingBar.appendChild(zeroCell);

  // Initialize cells 1-10
  for (let i = 1; i <= 10; i++) {
    const cell = document.createElement('div');
    cell.className = 'rating-cell';
    cell.dataset.value = i.toString();
    cell.textContent = i.toString(); // Display the number inside the cell
    ratingBar.appendChild(cell);

    cell.addEventListener('mouseenter', () => {
      selectedValue = parseInt(cell.dataset.value, 10);
      highlightCellsUpTo(selectedValue);
    });
  }

  zeroCell.addEventListener('mouseenter', () => {
    selectedValue = parseInt(zeroCell.dataset.value, 10);
    highlightCellsUpTo(selectedValue);
  });

  ratingBar.addEventListener('mouseleave', () => {
    highlightCellsUpTo(selectedValue);
  });

  // Append the rating bar to the modal body
  modalContentElement.appendChild(ratingBar);

  return {
    getRating: () => selectedValue,
    getElement: () => ratingBar,
  };
}

function createDialog(transitionInfo) {
  return new Promise((resolve, reject) => {
    // Find the modal elements
    const confirmationModalElement = document.getElementById('confirmationModal');
    const confirmationModal = new bootstrap.Modal(confirmationModalElement, {
      focus: true,
      backdrop: 'true'
    });
    const confirmButton = confirmationModalElement.querySelector('#confirmSave');
    const cancelButton = confirmationModalElement.querySelector('#cancelSaveTransition');
    const modalContentElement = confirmationModalElement.querySelector('.modal-content');

    // Use the helper function to bind data to the DOM elements
    const transitionDetails = {
      track1CueModal: transitionInfo.track1.cue1.name || '-',
      track2CueModal: transitionInfo.track2.cue1.name || '-',
      transitionTypeModal: transitionInfo.transition || '-',
      transitionModifiersModal: transitionInfo.modifiers ? transitionInfo.modifiers.map(modifier => `<li>${modifier}</li>`).join('') : '',
      track1TitleModal: transitionInfo.track1.path ? extractFileName(transitionInfo.track1.path) : '-',
      track2TitleModal: transitionInfo.track2.path ? extractFileName(transitionInfo.track2.path) : '-',
      transitionArrowModal: transitionInfo.direction === "left_to_right" ? '🡆' : '🡄'
    };

    bindDataToDOMElements(transitionDetails);

    // Set the comment in the textarea
    transitionCommentModal.value = transitionInfo.comment || '';
    
    /* Rating Bar */
    // Before creating a new rating bar, clear the previous one if it exists
    const existingRatingBar = modalContentElement.querySelector('#rating-bar');
    if (existingRatingBar) {
      modalContentElement.removeChild(existingRatingBar);
    }
    // Create the rating bar inside the modal body
    const ratingBarComponent = createRatingBar(modalContentElement);


    /* Event Listeners */
    // Event listener for the confirm button
    confirmButton.addEventListener('click', () => {
      const rating = ratingBarComponent.getRating();
      const updatedComment = transitionCommentModal.value;
      resolve({ rating: rating, comment: updatedComment });
      confirmationModal.hide();
    });

    // Event listener for the cancel button
    cancelButton.addEventListener('click', () => {
      reject(new Error('cancelled'));
      confirmationModal.hide();
    });

    // Clean up event listeners when the modal is hidden
    const onModalHidden = (event) => {
      if (event.target === confirmationModalElement) {
        confirmButton.removeEventListener('click', confirmButton.onclick);
        cancelButton.removeEventListener('click', cancelButton.onclick);
        confirmationModalElement.removeEventListener('hidden.bs.modal', onModalHidden);
        reject(new Error('dismissed'));
      }
    };

    confirmationModalElement.addEventListener('hidden.bs.modal', onModalHidden);
    
    confirmationModal.show();
  });
}

export { createDialog };