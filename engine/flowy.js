const flowy = function (canvas, grab, release, snapping, spacingX, spacingY) {
  // event listeners
  if (!grab) {
    grab = function () {};
  }
  if (!release) {
    release = function () {};
  }
  if (!snapping) {
    snapping = function () {
      return true;
    };
  }

  if (!spacingX) {
    spacingX = 20;
  }
  if (!spacingY) {
    spacingY = 80;
  }

  let loaded = false;
  flowy.load = function () {
    if (loaded) {
      return;
    }

    loaded = true;

    let blocks = [];
    let tmpBlock = [];
    let canvasDiv = canvas;
    let dragging = false;
    let paddingX = spacingX;
    let paddingY = spacingY;
    let offsetLeft = 0;
    let offsetLeftOld = 0;
    let rearrange = false;
    let lastEvent = false;
    let drag, dragX, dragY, original;
    let mouseX, mouseY;
    let dragBlock = false;
    let el = document.createElement("DIV");

    el.classList.add('indicator');
    el.classList.add('invisible');
    canvasDiv.appendChild(el);

    // import the flow from the given output
    flowy.import = function (output) {
      canvasDiv.innerHTML = JSON.parse(output.html);
      blocks = output.blockarr;
    }

    // export the flow
    flowy.output = function () {
      const serializedHTML = JSON.stringify(canvasDiv.innerHTML);
      const jsonData = {
        html: serializedHTML,
        blockarr: blocks,
        blocks: [],
      };

      if (blocks.length > 0) {
        for (let i = 0; i < blocks.length; i += 1) {
          jsonData.blocks.push({
            id: blocks[i].id,
            parent: blocks[i].parent,
            data: [],
            attr: [],
          });

          const blockElement = document.querySelector(`.blockid[value="${blocks[i].id}"]`).parentNode;
          blockElement.querySelectorAll('input').forEach((input) => {
            jsonData.blocks[i].data.push({
              name: input.getAttribute('name'),
              value: input.value,
            });
          });
          Array.prototype.slice.call(blockElement.attributes).forEach((attribute) => {
            const obj = {};
            obj[attribute.name] = attribute.value;
            jsonData.blocks[i].attr.push(obj);
          });
        }
        return jsonData;
      }
    }

    flowy.deleteBlocks = function () {
      blocks = [];
      canvasDiv.innerHTML = '<div class="indicator invisible"></div>';
    }

    function beginDrag(event) {
      mouseX = event.clientX;
      mouseY = event.clientY;

      // 1: left-click, 2: middle-click, 3: right-click
      if (event.which !== 3 && event.target.closest('.create-flowy')) {
        original = event.target.closest('.create-flowy');
        original.classList.add('dragnow');

        // clone the node including all children
        const newNode = original.cloneNode(true);
        newNode.classList.add('block');
        newNode.classList.remove('create-flowy');

        const nextId = (blocks.length === 0) ? 0 /* first block */ : (Math.max.apply(Math, blocks.map(block => block.id)) + 1);
        newNode.innerHTML += `<input type="hidden" name="blockid" class="blockid" value="${nextId}">`;
        document.body.appendChild(newNode);
        drag = document.querySelector(`.blockid[value="${nextId}"]`).parentNode;

        // emit the onGrab event
        blockGrabbed(original);

        drag.classList.add('dragging');
        dragging = true;

        // update positions of the grabbed node
        dragX = mouseX - pageX(original);
        dragY = mouseY - pageY(original);
        drag.style.left = `${mouseX - dragX}px`;
        drag.style.top = `${mouseY - dragY}px`;
      }
    }

    function endDrag(event) {
      // 1: left-click, 2: middle-click, 3: right-click
      if (event.which !== 3 && (dragging || rearrange)) {
        // emit the onRelease event
        blockReleased();

        dragBlock = false;

        if (!document.querySelector('.indicator').classList.contains('invisible')) {
          document.querySelector('.indicator').classList.add('invisible');
        }

        // stop tracking
        if (dragging) {
          original.classList.remove('dragnow');
          drag.classList.remove('dragging');
        }

        const blockId = parseInt(drag.querySelector('.blockid').value, 10);
        if (blockId === 0 && rearrange) {
          drag.classList.remove('dragging');
          rearrange = false;

          for (let i = 0; i < tmpBlock.length; i += 1) {
            if (tmpBlock[i].id !== blockId) {
              const blockElement = document.querySelector(`.blockid[value="${tmpBlock[i].id}"]`).parentNode;
              const arrowBlock = document.querySelector(`.arrowid[value="${tmpBlock[i].id}"]`).parentNode;

              blockElement.style.left = (blockElement.getBoundingClientRect().left + window.scrollX) - (canvasDiv.getBoundingClientRect().left + window.scrollX) + canvasDiv.scrollLeft;
              blockElement.style.top = (blockElement.getBoundingClientRect().top + window.scrollY) - (canvasDiv.getBoundingClientRect().top + window.scrollY) + canvasDiv.scrollTop;

              arrowBlock.style.left = (arrowBlock.getBoundingClientRect().left + window.scrollX) - (canvasDiv.getBoundingClientRect().left + window.scrollX) + canvasDiv.scrollLeft;
              arrowBlock.style.top = (arrowBlock.getBoundingClientRect().top + window.scrollY) - (canvasDiv.getBoundingClientRect().top + canvasDiv.scrollTop);

              canvasDiv.appendChild(blockElement);
              canvasDiv.appendChild(arrowBlock);

              tmpBlock[i].x = (blockElement.getBoundingClientRect().left + window.scrollX) + (parseInt(blockElement.offsetWidth, 10) / 2) + canvasDiv.scrollLeft;
              tmpBlock[i].y = (blockElement.getBoundingClientRect().top + window.scrollY) + (parseInt(blockElement.offsetHeight, 10) / 2) + canvasDiv.scrollTop;
            }
          }

          tmpBlock.filter(block => (block.id === 0))[0].x = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width, 10) / 2);
          tmpBlock.filter(a => a.id == 0)[0].y = (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height, 10) / 2);
          blocks = blocks.concat(tmpBlock);
          tmpBlock = [];
        } else if (dragging && blocks.length === 0 && (drag.getBoundingClientRect().top + window.scrollY) > (canvasDiv.getBoundingClientRect().top + window.scrollY) && (drag.getBoundingClientRect().left + window.scrollX) > (canvasDiv.getBoundingClientRect().left + window.scrollX)) {
          blockSnap(drag, true, undefined);
          dragging = false;

          drag.style.top = (drag.getBoundingClientRect().top + window.scrollY) - (canvasDiv.getBoundingClientRect().top + window.scrollY) + canvasDiv.scrollTop;
          drag.style.left = (drag.getBoundingClientRect().left + window.scrollX) - (canvasDiv.getBoundingClientRect().left + window.scrollX) + canvasDiv.scrollLeft;
          canvasDiv.appendChild(drag);

          blocks.push({
            parent: -1,
            childwidth: 0,
            id: blockId,
            x: (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width, 10) / 2) + canvasDiv.scrollLeft,
            y: (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height, 10) / 2) + canvasDiv.scrollTop,
            width: parseInt(window.getComputedStyle(drag).width, 10),
            height: parseInt(window.getComputedStyle(drag).height, 10),
          });
        } else if (dragging && blocks.length === 0) {
          canvasDiv.appendChild(document.querySelector('.indicator'));
          drag.parentNode.removeChild(drag);
        } else if (dragging || rearrange) {
          const xPos = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width, 10) / 2) + canvasDiv.scrollLeft;
          const yPos = (drag.getBoundingClientRect().top + window.scrollY) + canvasDiv.scrollTop
          const blockIds = blocks.map(block => block.id);

          for (let i = 0; i < blocks.length; i += 1) {
            if (xPos >= blocks.filter(block => (block.id === blockIds[i]))[0].x - (blocks.filter(block => (block.id === blockIds[i]))[0].width / 2) - paddingX && xPos <= blocks.filter(block => (block.id === blockIds[i]))[0].x + (blocks.filter(block => (block.id === blockIds[i]))[0].width / 2) + paddingX && yPos >= blocks.filter(block => (block.id === blockIds[i]))[0].y - (blocks.filter(block => (block.id === blockIds[i]))[0].height / 2) && yPos <= blocks.filter(block => (block.id === blockIds[i]))[0].y + blocks.filter(block => (block.id === blockIds[i]))[0].height) {
              dragging = false;

              if (!rearrange && blockSnap(drag, false, blocks.filter(block => (block.id === blockIds[i]))[0])) {
                snap(drag,i, blockIds);
              } else if (rearrange) {
                snap(drag,i, blockIds);
              }

              break;
            } else if (i === blocks.length - 1) {
              if (rearrange) {
                rearrange = false;
                tmpBlock = [];
              }

              dragging = false;
              canvasDiv.appendChild(document.querySelector('.indicator'));
              drag.parentNode.removeChild(drag);
            }
          }
        }
      }
    }

    function snap(drag, i, blockIds) {
      if (!rearrange) {
        canvasDiv.appendChild(drag);
      }
      var totalwidth = 0;
      var totalremove = 0;
      for (var w = 0; w < blocks.filter(id => id.parent == blockIds[i]).length; w++) {
        var children = blocks.filter(id => id.parent == blockIds[i])[w];
        if (children.childwidth > children.width) {
          totalwidth += children.childwidth + paddingX;
        } else {
          totalwidth += children.width + paddingX;
        }
      }
      totalwidth += parseInt(window.getComputedStyle(drag).width);
      for (var w = 0; w < blocks.filter(id => id.parent == blockIds[i]).length; w++) {
        var children = blocks.filter(id => id.parent == blockIds[i])[w];
        if (children.childwidth > children.width) {
          document.querySelector(`.blockid[value="${children.id}"]`).parentNode.style.left = `${blocks.filter(a => a.id == blockIds[i])[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2) - (children.width / 2)}px`;
          children.x = blocks.filter(id => id.parent == blockIds[i])[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2);
          totalremove += children.childwidth + paddingX;
        } else {
          document.querySelector(`.blockid[value="${children.id}"]`).parentNode.style.left = `${blocks.filter(a => a.id == blockIds[i])[0].x - (totalwidth / 2) + totalremove}px`;
          children.x = blocks.filter(id => id.parent == blockIds[i])[0].x - (totalwidth / 2) + totalremove + (children.width / 2);
          totalremove += children.width + paddingX;
        }
      }
      drag.style.left = `${blocks.filter(id => id.id == blockIds[i])[0].x - (totalwidth / 2) + totalremove - (canvasDiv.getBoundingClientRect().left + window.scrollX) + canvasDiv.scrollLeft}px`;
      drag.style.top = `${blocks.filter(id => id.id == blockIds[i])[0].y + (blocks.filter(id => id.id == blockIds[i])[0].height / 2) + paddingY - (canvasDiv.getBoundingClientRect().top + window.scrollY)}px`;
      if (rearrange) {
        tmpBlock.filter(a => a.id == parseInt(drag.querySelector('.blockid').value))[0].x = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvasDiv.scrollLeft + canvasDiv.scrollLeft;
        tmpBlock.filter(a => a.id == parseInt(drag.querySelector('.blockid').value))[0].y = (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvasDiv.scrollTop;
        tmpBlock.filter(a => a.id == drag.querySelector('.blockid').value)[0].parent = blockIds[i];
        for (var w = 0; w < tmpBlock.length; w++) {
          if (tmpBlock[w].id != parseInt(drag.querySelector('.blockid').value)) {
            const blockParent = document.querySelector(`.blockid[value="${tmpBlock[w].id}"]`).parentNode;
            const arrowParent = document.querySelector(`.arrowid[value="${tmpBlock[w].id}"]`).parentNode;
            blockParent.style.left = (blockParent.getBoundingClientRect().left + window.scrollX) - (canvasDiv.getBoundingClientRect().left + window.scrollX) + canvasDiv.scrollLeft;
            blockParent.style.top = (blockParent.getBoundingClientRect().top + window.scrollY) - (canvasDiv.getBoundingClientRect().top + window.scrollY) + canvasDiv.scrollTop;
            arrowParent.style.left = (arrowParent.getBoundingClientRect().left + window.scrollX) - (canvasDiv.getBoundingClientRect().left + window.scrollX) + canvasDiv.scrollLeft + 20;
            arrowParent.style.top = (arrowParent.getBoundingClientRect().top + window.scrollY) - (canvasDiv.getBoundingClientRect().top + window.scrollY) + canvasDiv.scrollTop;
            canvasDiv.appendChild(blockParent);
            canvasDiv.appendChild(arrowParent);

            tmpBlock[w].x = (blockParent.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(blockParent).width) / 2) + canvasDiv.scrollLeft;
            tmpBlock[w].y = (blockParent.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(blockParent).height) / 2) + canvasDiv.scrollTop;
          }
        }
        blocks = blocks.concat(tmpBlock);
        tmpBlock = [];
      } else {
        blocks.push({
          childwidth: 0,
          parent: blockIds[i],
          id: parseInt(drag.querySelector('.blockid').value),
          x: (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvasDiv.scrollLeft,
          y: (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvasDiv.scrollTop,
          width: parseInt(window.getComputedStyle(drag).width),
          height: parseInt(window.getComputedStyle(drag).height)
        });
      }
      var arrowhelp = blocks.filter(a => a.id == parseInt(drag.querySelector('.blockid').value))[0];
      var arrowx = arrowhelp.x - blocks.filter(a => a.id == blockIds[i])[0].x + 20;
      var arrowy = parseFloat(arrowhelp.y - (arrowhelp.height / 2) - (blocks.filter(id => id.parent == blockIds[i])[0].y + (blocks.filter(id => id.parent == blockIds[i])[0].height / 2)) + canvasDiv.scrollTop);
      if (arrowx < 0) {
        canvasDiv.innerHTML += `<div class="arrowblock"><input type="hidden" class="arrowid" value="${drag.querySelector('.blockid').value}"><svg preserveaspectratio="none" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M${(blocks.filter(a => a.id == blockIds[i])[0].x - arrowhelp.x + 5)} 0L${(blocks.filter(a => a.id == blockIds[i])[0].x - arrowhelp.x + 5)} ${(paddingY / 2)}L5 ${(paddingY / 2)}L5 ${arrowy}" stroke="#C5CCD0" stroke-width="2px"/><path d="M0 ${(arrowy - 5)}H10L5 ${arrowy}L0 ${(arrowy - 5)}Z" fill="#C5CCD0"/></svg></div>`;
        document.querySelector(`.arrowid[value="${drag.querySelector('.blockid').value}"]`).parentNode.style.left = `${(arrowhelp.x - 5) - (canvasDiv.getBoundingClientRect().left + window.scrollX) + canvasDiv.scrollLeft}px`;
      } else {
        canvasDiv.innerHTML += `<div class="arrowblock"><input type="hidden" class="arrowid" value="${drag.querySelector('.blockid').value}"><svg preserveaspectratio="none" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 0L20 ${(paddingY / 2)}L${(arrowx)} ${(paddingY / 2)}L${arrowx} ${arrowy}" stroke="#C5CCD0" stroke-width="2px"/><path d="M${(arrowx - 5)} ${(arrowy - 5)}H${(arrowx + 5)}L${arrowx} ${arrowy}L${(arrowx - 5)} ${(arrowy - 5)}Z" fill="#C5CCD0"/></svg></div>`;
        document.querySelector(`.arrowid[value="${parseInt(drag.querySelector('.blockid').value)}"]`).parentNode.style.left = `${blocks.filter(a => a.id == blockIds[i])[0].x - 20 - (canvasDiv.getBoundingClientRect().left + window.scrollX) + canvasDiv.scrollLeft}px`;
      }
      document.querySelector(`.arrowid[value="${parseInt(drag.querySelector('.blockid').value)}"]`).parentNode.style.top = `${blocks.filter(a => a.id == blockIds[i])[0].y + (blocks.filter(a => a.id == blockIds[i])[0].height / 2)}px`;
      if (blocks.filter(a => a.id == blockIds[i])[0].parent != -1) {
        var flag = false;
        var idval = blockIds[i];
        while (!flag) {
          if (blocks.filter(a => a.id == idval)[0].parent == -1) {
            flag = true;
          } else {
            var zwidth = 0;
            for (var w = 0; w < blocks.filter(id => id.parent == idval).length; w++) {
                var children = blocks.filter(id => id.parent == idval)[w];
                if (children.childwidth > children.width) {
                    if (w == blocks.filter(id => id.parent == idval).length - 1) {
                        zwidth += children.childwidth;
                    } else {
                        zwidth += children.childwidth + paddingX;
                    }
                } else {
                    if (w == blocks.filter(id => id.parent == idval).length - 1) {
                        zwidth += children.width;
                    } else {
                        zwidth += children.width + paddingX;
                    }
                }
            }
            blocks.filter(a => a.id == idval)[0].childwidth = zwidth;
            idval = blocks.filter(a => a.id == idval)[0].parent;
          }
        }
        blocks.filter(id => id.id == idval)[0].childwidth = totalwidth;
      }
      if (rearrange) {
        rearrange = false;
        drag.classList.remove('dragging');
      }
      rearrangeMe();
      checkOffset();
    }

    function hasParentClass(element, classname) {
      if (element.className) {
        if (element.className.split(' ').indexOf(classname) !== -1) {
          return true;
        }
      }
      return element.parentNode && hasParentClass(element.parentNode, classname);
    }

    function touchblock(event) {
      if (hasParentClass(event.target, 'block')) {
        const theblock = event.target.closest('.block');
        mouseX = event.clientX;
        mouseY = event.clientY;
        if (event.type !== 'mouseup' && hasParentClass(event.target, 'block')) {
          if (event.which != 3) {
            if (!dragging && !rearrange) {
              dragBlock = true;
              drag = theblock;
              dragX = mouseX - (drag.getBoundingClientRect().left + window.scrollX);
              dragY = mouseY - (drag.getBoundingClientRect().top + window.scrollY);
            }
          }
        }
      }
    }

    function touchDone() {
      dragBlock = false;
    }

    function pageX(element){
      return element.offsetParent ? element.offsetLeft + pageX(element.offsetParent) : element.offsetLeft;
    }

    function pageY(element){
      return element.offsetParent ? element.offsetTop + pageY(element.offsetParent) : element.offsetTop;
    }

    function moveBlock(event) {
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (dragBlock) {
        rearrange = true;
        drag.classList.add('dragging');
        var blockid = parseInt(drag.querySelector('.blockid').value);
        tmpBlock.push(blocks.filter(a => a.id === blockid)[0]);
        blocks = blocks.filter(function(e) {
          return e.id != blockid
        });
        if (blockid != 0) {
          document.querySelector(`.arrowid[value="${blockid}"]`).parentNode.remove();
        }
        var layer = blocks.filter(a => a.parent === blockid);
        var flag = false;
        var foundids = [];
        var allids = [];

        const dragRect = drag.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        while (!flag) {
          for (var i = 0; i < layer.length; i++) {
            if (layer[i] != blockid) {
              tmpBlock.push(blocks.filter(a => a.id == layer[i].id)[0]);
              const blockParent = document.querySelector(`.blockid[value="${layer[i].id}"]`).parentNode;
              const arrowParent = document.querySelector(`.arrowid[value="${layer[i].id}"]`).parentNode;
              const blockParentRect = blockParent.getBoundingClientRect();
              const arrowParentRect = arrowParent.getBoundingClientRect();
              blockParent.style.left = (blockParentRect.left + scrollX) - (dragRect.left + scrollX);
              blockParent.style.top = (blockParentRect.top + scrollY) - (dragRect.top + scrollY);
              arrowParent.style.left = (arrowParentRect.left + scrollX) - (dragRect.left + scrollX);
              arrowParent.style.top = (arrowParentRect.top + scrollY) - (dragRect.top + scrollY);
              drag.appendChild(blockParent);
              drag.appendChild(arrowParent);
              foundids.push(layer[i].id);
              allids.push(layer[i].id);
            }
          }
          if (foundids.length === 0) {
            flag = true;
          } else {
            layer = blocks.filter(a => foundids.includes(a.parent));
            foundids = [];
          }
        }
        for (var i = 0; i < blocks.filter(a => a.parent === blockid).length; i++) {
            var blocknumber = blocks.filter(a => a.parent === blockid)[i];
            blocks = blocks.filter(function(e) {
                return e.id !== blocknumber
            });
        }
        for (var i = 0; i < allids.length; i++) {
            var blocknumber = allids[i];
            blocks = blocks.filter(function(e) {
                return e.id !== blocknumber
            });
        }
        if (blocks.length > 1) {
            rearrangeMe();
        }
        if (lastEvent) {
            fixOffset();
        }
        dragBlock = false;
      }
      if (dragging) {
        drag.style.left = `${mouseX - dragX}px`;
        drag.style.top = `${mouseY - dragY}px`;
      } else if (rearrange) {
        const canvasDivRect = canvasDiv.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        drag.style.left = `${mouseX - dragX - (canvasDivRect.left + scrollX) + canvasDiv.scrollLeft}px`;
        drag.style.top = `${mouseY - dragY - (canvasDivRect.top + scrollY) + canvasDiv.scrollTop}px`;
        tmpBlock.filter(a => a.id === parseInt(drag.querySelector('.blockid').value)).x = (drag.getBoundingClientRect().left + scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvasDiv.scrollLeft;
        tmpBlock.filter(a => a.id === parseInt(drag.querySelector('.blockid').value)).y = (drag.getBoundingClientRect().left + scrollX) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvasDiv.scrollTop;
      }
      if (dragging || rearrange) {
        const dragRect = drag.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        var xpos = (dragRect.left + scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvasDiv.scrollLeft;
        var ypos = (dragRect.top + scrollY) + canvasDiv.scrollTop;
        var blocko = blocks.map(a => a.id);
        for (var i = 0; i < blocks.length; i++) {
          if (xpos >= blocks.filter(a => a.id === blocko[i])[0].x - (blocks.filter(a => a.id === blocko[i])[0].width / 2) - paddingX && xpos <= blocks.filter(a => a.id === blocko[i])[0].x + (blocks.filter(a => a.id === blocko[i])[0].width / 2) + paddingX && ypos >= blocks.filter(a => a.id === blocko[i])[0].y - (blocks.filter(a => a.id === blocko[i])[0].height / 2) && ypos <= blocks.filter(a => a.id === blocko[i])[0].y + blocks.filter(a => a.id == blocko[i])[0].height) {
            const block = document.querySelector(`.blockid[value="${blocko[i]}"]`);
            block.parentNode.appendChild(document.querySelector('.indicator'));
            document.querySelector('.indicator').style.left = `${(parseInt(window.getComputedStyle(block.parentNode).width) / 2) - 5}px`;
            document.querySelector('.indicator').style.top = window.getComputedStyle(block.parentNode).height;
            document.querySelector('.indicator').classList.remove('invisible');
            break;
          } else if (i == blocks.length - 1) {
            if (!document.querySelector('.indicator').classList.contains('invisible')) {
              document.querySelector('.indicator').classList.add('invisible');
            }
          }
        }
      }
    }

    function checkOffset() {
      offsetLeft = blocks.map(a => a.x);
      var widths = blocks.map(a => a.width);
      var mathmin = offsetLeft.map(function(item, index) {
          return item - (widths[index] / 2);
      })
      offsetLeft = Math.min.apply(Math, mathmin);
      if (offsetLeft < (canvasDiv.getBoundingClientRect().left + window.scrollX)) {
        lastEvent = true;
        var blocko = blocks.map(a => a.id);
        for (var w = 0; w < blocks.length; w++) {
          document.querySelector(`.blockid[value="${blocks.filter(a => a.id == blocko[w])[0].id}"]`).parentNode.style.left = blocks.filter(a => a.id == blocko[w])[0].x - (blocks.filter(a => a.id == blocko[w])[0].width / 2) - offsetLeft + 20;
          if (blocks.filter(a => a.id == blocko[w])[0].parent != -1) {
            var arrowhelp = blocks.filter(a => a.id == blocko[w])[0];
            var arrowx = arrowhelp.x - blocks.filter(a => a.id == blocks.filter(a => a.id == blocko[w])[0].parent)[0].x;
            if (arrowx < 0) {
              document.querySelector(`.arrowid[value="${blocko[w]}"]`).parentNode.style.left = `${(arrowhelp.x - offsetLeft + 20 - 5)}px`;
            } else {
              document.querySelector(`.arrowid[value="${blocko[w]}"]`).parentNode.style.left = `${blocks.filter(id => id.id == blocks.filter(a => a.id == blocko[w])[0].parent)[0].x - 20 - offsetLeft + 20}px`;
            }
          }
        }
        for (var w = 0; w < blocks.length; w++) {
          blocks[w].x = (document.querySelector(`.blockid[value="${blocks[w].id}"]`).parentNode.getBoundingClientRect().left + window.scrollX) + (canvasDiv.getBoundingClientRect().left + canvasDiv.scrollLeft) - (parseInt(window.getComputedStyle(document.querySelector(`.blockid[value="${blocks[w].id}"]`).parentNode).width) / 2) - 40;
        }
        offsetLeftOld = offsetLeft;
      }
    }

    function fixOffset() {
      if (offsetLeftOld < (canvasDiv.getBoundingClientRect().left + window.scrollX)) {
        lastEvent = false;
        var blocko = blocks.map(a => a.id);
        for (var w = 0; w < blocks.length; w++) {
          document.querySelector(`.blockid[value="${blocks.filter(a => a.id == blocko[w])[0].id}"]`).parentNode.style.left = blocks.filter(a => a.id == blocko[w])[0].x - (blocks.filter(a => a.id == blocko[w])[0].width / 2) - offsetLeftOld - 20;
          blocks.filter(a => a.id == blocko[w])[0].x = (document.querySelector(`.blockid[value="${blocks.filter(a => a.id == blocko[w])[0].id}"]`).parentNode.getBoundingClientRect().left + window.scrollX) + (blocks.filter(a => a.id == blocko[w])[0].width / 2);

          if (blocks.filter(a => a.id == blocko[w])[0].parent != -1) {
            var arrowhelp = blocks.filter(a => a.id == blocko[w])[0];
            var arrowx = arrowhelp.x - blocks.filter(a => a.id == blocks.filter(a => a.id == blocko[w])[0].parent)[0].x;
            if (arrowx < 0) {
              document.querySelector(`.arrowid[value="${blocko[w]}"]`).parentNode.style.left = `${arrowhelp.x - 5 - (canvasDiv.getBoundingClientRect().left + window.scrollX)}px`;
            } else {
              document.querySelector(`.arrowid[value="${blocko[w]}"]`).parentNode.style.left = `${blocks.filter(id => id.id == blocks.filter(a => a.id == blocko[w])[0].parent)[0].x - 20 - (canvasDiv.getBoundingClientRect().left + window.scrollX)}px`;
            }
          }
        }
        offsetLeftOld = 0;
      }
    }

    function rearrangeMe() {
      var result = blocks.map(a => a.parent);
      for (var z = 0; z < result.length; z++) {
        if (result[z] == -1) {
          z++;
        }
        var totalwidth = 0;
        var totalremove = 0;
        for (var w = 0; w < blocks.filter(id => id.parent == result[z]).length; w++) {
          var children = blocks.filter(id => id.parent == result[z])[w];
          if (blocks.filter(id => id.parent == children.id).length == 0) {
            children.childwidth = 0;
          }
          if (children.childwidth > children.width) {
            if (w == blocks.filter(id => id.parent == result[z]).length - 1) {
              totalwidth += children.childwidth;
            } else {
              totalwidth += children.childwidth + paddingX;
            }
          } else {
            if (w == blocks.filter(id => id.parent == result[z]).length - 1) {
              totalwidth += children.width;
            } else {
              totalwidth += children.width + paddingX;
            }
          }
        }
        if (result[z] != -1) {
          blocks.filter(a => a.id == result[z])[0].childwidth = totalwidth;
        }
        for (var w = 0; w < blocks.filter(id => id.parent == result[z]).length; w++) {
          var children = blocks.filter(id => id.parent == result[z])[w];
          const r_block = document.querySelector(`.blockid[value="${children.id}"]`).parentNode;
          const r_array = blocks.filter(id => id.id == result[z]);
          r_block.style.top = `${r_array.y + paddingY}px`;
          r_array.y = r_array.y + paddingY;
          if (children.childwidth > children.width) {
            r_block.style.left = `${r_array[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2) - (children.width / 2) - (canvasDiv.getBoundingClientRect().left + window.scrollX)}px`;
            children.x = r_array[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2);
            totalremove += children.childwidth + paddingX;
          } else {
            r_block.style.left = `${r_array[0].x - (totalwidth / 2) + totalremove - (canvasDiv.getBoundingClientRect().left + window.scrollX)}px`;
            children.x = r_array[0].x - (totalwidth / 2) + totalremove + (children.width / 2);
            totalremove += children.width + paddingX;
          }
          var arrowhelp = blocks.filter(a => a.id == children.id)[0];
          var arrowx = arrowhelp.x - blocks.filter(a => a.id == children.parent)[0].x + 20;
          var arrowy = arrowhelp.y - (arrowhelp.height / 2) - (blocks.filter(a => a.id == children.parent)[0].y + (blocks.filter(a => a.id == children.parent)[0].height / 2));
          document.querySelector(`.arrowid[value="${children.id}"]`).parentNode.style.top = `${blocks.filter(id => id.id == children.parent)[0].y + (blocks.filter(id => id.id == children.parent)[0].height / 2) - (canvasDiv.getBoundingClientRect().top + window.scrollY)}px`;
          if (arrowx < 0) {
            document.querySelector(`.arrowid[value="${children.id}"]`).parentNode.style.left = `${(arrowhelp.x - 5) - (canvasDiv.getBoundingClientRect().left + window.scrollX)}px`;
            document.querySelector(`.arrowid[value="${children.id}"]`).parentNode.innerHTML = `<input type="hidden" class="arrowid" value="${children.id}"><svg preserveaspectratio="none" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M${(blocks.filter(id => id.id == children.parent)[0].x - arrowhelp.x + 5)} 0L${(blocks.filter(id => id.id == children.parent)[0].x - arrowhelp.x + 5)} ${(paddingY / 2)}L5 ${(paddingY / 2)}L5 ${arrowy}" stroke="#C5CCD0" stroke-width="2px"/><path d="M0 ${(arrowy - 5)}H10L5 ${arrowy}L0 ${(arrowy - 5)}Z" fill="#C5CCD0"/></svg>`;
          } else {
            document.querySelector(`.arrowid[value="${children.id}"]`).parentNode.style.left = `${blocks.filter(id => id.id == children.parent)[0].x - 20 - (canvasDiv.getBoundingClientRect().left + window.scrollX)}px`;
            document.querySelector(`.arrowid[value="${children.id}"]`).parentNode.innerHTML = `<input type="hidden" class="arrowid" value="${children.id}"><svg preserveaspectratio="none" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 0L20 ${(paddingY / 2)}L${(arrowx)} ${(paddingY / 2)}L${arrowx} ${arrowy}" stroke="#C5CCD0" stroke-width="2px"/><path d="M${(arrowx - 5)} ${(arrowy - 5)}H${(arrowx + 5)}L${arrowx} ${arrowy}L${(arrowx - 5)} ${(arrowy - 5)}Z" fill="#C5CCD0"/></svg>`;
          }
        }
      }
    }

    document.addEventListener('mousedown', touchblock);
    document.addEventListener('mousedown', beginDrag);
    document.addEventListener('mouseup', touchDone);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mousemove', moveBlock);
  }
  flowy.load();

  function blockGrabbed(block) {
    grab(block);
  }

  function blockReleased() {
    release();
  }

  function blockSnap(drag, first, parent) {
    return snapping(drag, first, parent);
  }
}

