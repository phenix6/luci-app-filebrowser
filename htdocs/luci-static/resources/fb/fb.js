String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};
(function () {
  var iwxhr = new XHR();
  var listElem = document.getElementById("list-content");
  var pathElem = document.getElementById("current-path");
  listElem.onclick = handleClick;
  var currentPath;
  pathElem.onblur = function () {
    var path = this.value.trim();
    if (currentPath !== path)
    update_list(path);
  };
  pathElem.onkeyup = function (evt) {
    if (evt.keyCode == 13) {
      this.blur();
    }
  };
  function removePath(filename, isdir) {
      var c = confirm('确认删除 ' + filename + ' ?');
      if (c) {
          iwxhr.get('/cgi-bin/luci/admin/system/filebrowser_delete',
            {
                path: concatPath(currentPath, filename),
                isdir: isdir
            },
            function (x) {
              update_list(currentPath);
          });
      }
  }
  function renamePath(filename) {
      var newname = prompt('输入新名字:', filename).trim();
      if (newname && newname != filename) {
          var newpath = concatPath(currentPath, newname);
          iwxhr.get('/cgi-bin/luci/admin/system/filebrowser_rename', {
              filepath: concatPath(currentPath, filename),
              newpath: newpath
          },function(x, ifc){
              update_list(currentPath);
          });
      }
  }

  function openpath(filename, dirname) {
    dirname = dirname || currentPath;
    var encodePath = encodeURIComponent(concatPath(dirname, filename).replace(/\//g, '<>'));
    window.open('/cgi-bin/luci/admin/system/filebrowser_open/' + encodePath + '/' + filename);
  }

  function getFileElem(elem) {
    if (elem.className.indexOf('-icon') > -1) {
      return elem;
    }
    else if (elem.parentNode.className.indexOf('-icon') > -1) {
      return elem.parentNode;
    }
  }

  function concatPath(path, filename) {
    if (path === '/') {
      return path + filename;
    }
    else {
      return path.replace(/\/$/, '') + '/' + filename;
    }
  }

  function handleClick(evt) {
    var targetElem = evt.target;
    var infoElem;
    if (targetElem.className.indexOf('cbi-button-remove') > -1) {
      infoElem = targetElem.parentNode.parentNode;
      removePath(infoElem.dataset['filename'] , infoElem.dataset['isdir'])
    }
    else if (targetElem.className.indexOf('cbi-button-edit') > -1) {
      renamePath(targetElem.parentNode.parentNode.dataset['filename']);
    }
    else if (targetElem = getFileElem(targetElem)) {
      if (targetElem.className.indexOf('parent-icon') > -1) {
        update_list(currentPath.replace(/\/[^/]+($|\/$)/, ''));
      }
      else if (targetElem.className.indexOf('file-icon') > -1) {
        openpath(targetElem.parentNode.dataset['filename']);
      }
      else if (targetElem.className.indexOf('link-icon') > -1) {
        infoElem = targetElem.parentNode;
        var filepath = infoElem.dataset['linktarget'];
        if (filepath) {
          if (infoElem.dataset['isdir'] === "1") {
            update_list(filepath);
          }
          else {
            var lastSlash = filepath.lastIndexOf('/');
            openpath(filepath.substring(lastSlash + 1), filepath.substring(0, lastSlash));
          }
        }
      }
      else if (targetElem.className.indexOf('folder-icon') > -1) {
        update_list(concatPath(currentPath, targetElem.parentNode.dataset['filename']))
      }
    }
  }
  function update_list(path) {
    path = concatPath(path, '');
    iwxhr.get('/cgi-bin/luci/admin/system/filebrowser_list',
      {path: path},
      function (x, ifc) {
        var filenames = ifc;
        var listHtml = '<table id="fb-table" class="cbi-section-table"><tbody>';
        if (path !== '/') {
          listHtml += '<tr><td class="parent-icon" colspan="6"><strong>..</strong></td></tr>';
        }
        if (filenames) {
          for (var i = 0; i < filenames.length; i++) {
            var line = filenames[i];
            if (line) {
              var f = line.match(/(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([\S\s]+)/);
              var isLink = f[1][0] === 'z' || f[1][0] === 'l' || f[1][0] === 'x';
              var o = {
                displayname: f[9],
                filename: isLink ? f[9].split(' -> ')[0] : f[9],
                perms: f[1],
                date: f[7] + ' ' + f[6] + ' ' + f[8],
                size: f[5],
                owner: f[3],
                icon: (f[1][0] === 'd') ? "folder-icon" : (isLink ? "link-icon" : "file-icon")
              };
              listHtml += '<tr class="cbi-section-table-row cbi-rowstyle-' + (1 + i%2)
                + '" data-filename="' + o.filename + '" data-isdir="' + Number(f[1][0] === 'd' || f[1][0] === 'z') + '"'
                + ((f[1][0] === 'z' || f[1][0] === 'l') ? (' data-linktarget="' + f[9].split(' -> ')[1]) : '')
                + '">'
                + '<td class="cbi-value-field ' + o.icon + '">'
                +   '<strong>' + o.displayname + '</strong>'
                + '</td>'
                + '<td class="cbi-value-field cbi-value-owner">'+o.owner+'</td>'
                + '<td class="cbi-value-field cbi-value-date">'+o.date+'</td>'
                + '<td class="cbi-value-field cbi-value-size">'+o.size+'</td>'
                + '<td class="cbi-value-field cbi-value-perm">'+o.perms+'</td>'
                + '<td class="cbi-section-table-cell"><button class="cbi-button cbi-button-edit">重命名</button>\
                    <button class="cbi-button cbi-button-remove">删除</button></td>'
                + '</tr>';
            }
          }
        }
        listHtml += "</table>";
        listElem.innerHTML = listHtml;
        currentPath = path;
      }
    );
    history.pushState(null, null, '?path=' + path);
    pathElem.value = path;
    document.getElementById("upload-dir").value = concatPath(path, '');
  };

  var uploadToggle = document.getElementById('upload-toggle');
  var uploadContainer = document.getElementById('upload-container');
  var isUploadHide = true;
  uploadToggle.onclick = function() {
      if (isUploadHide) {
          uploadContainer.style.display = 'inline-flex';
      }
      else {
          uploadContainer.style.display = 'none';
      }
      isUploadHide = !isUploadHide;
  };
  uploadContainer.onsubmit = function (evt) {
    if (uploadinput.value === '') {
      evt.preventDefault();
    }
  };

  var uploadinput = document.getElementById('upload-file');
  uploadinput.addEventListener('change', function () {
    var fullPath = uploadinput.value;
    if (fullPath) {
        var startIndex = (fullPath.indexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
        var filename = fullPath.substring(startIndex + 1);
        var uploadFilename = document.getElementById('upload-filename');
        uploadFilename.value = filename;
    }
  });

  document.addEventListener("DOMContentLoaded", function(evt) {
    var initPath = '/';
      if (/path=([/\w]+)/.test(location.search)) {
        initPath = RegExp.$1;
    }
    update_list(initPath);
  });
})();