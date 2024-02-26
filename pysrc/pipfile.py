"""Simplistic parsing of Pipfile dependency files

This only extracts a small subset of the information present in a Pipfile,
as needed for the purposes of this library.
"""
import utils

import pytoml


class PipfileRequirement(object):
    def __init__(self, name):
        self.name = name

        self.editable = False
        self.vcs = None
        self.vcs_uri = None
        self.version = None
        self.markers = None
        self.provenance = None # a tuple of (file name, line)

    def __repr__(self):
        return str(self.__dict__())

    def __dict__(self):
        return {
            "name": self.name,
            "editable": self.editable,
            "vcs": self.vcs,
            "vcs_uri": self.vcs_uri,
            "version": self.version,
            "markers": self.markers,
            "provenance": self.provenance,
        }

    def __eq__(self, other):
        if isinstance(other, PipfileRequirement):
            return self.__dict__() == other.__dict__()
        return False

    @classmethod
    def from_dict(cls, name, requirement_dict, pos_in_toml):
        req = cls(name)

        req.version = parse_req(requirement_dict.get('version'))
        req.editable = parse_req(requirement_dict.get('editable', False))
        for vcs in ['git', 'hg', 'svn', 'bzr']:
            if vcs in requirement_dict:
                req.vcs = vcs
                req.vcs_uri = requirement_dict[vcs]
                break
        req.markers = parse_req(requirement_dict.get('markers'))
        # proper file name to be injected into provenance by the calling code
        req.provenance = ('Pipfile', pos_in_toml[0], pos_in_toml[0])
        return req

'''
The toml parser returns each requirement as a tuple
of the value and ending position, for multiple requirements
e.g.
{
    'version': ('*', (9, 23)),
    'markers': ("sys_platform == 'linux' ; python_version != '3.4'", (8, 36))
} for entry  waitress = {version = "*", markers="sys_platform == 'linux' ; python_version != '3.4'"}
This functions returns the value without the position for one such instance
e.g. parse_req(("sys_platform == 'linux' ; python_version != '3.4'", (8, 36))) returns "sys_platform == 'linux' ; python_version != '3.4'"
'''
def parse_req(pipfile_req):
    if type(pipfile_req) is tuple:
        return pipfile_req[0]
    else:
        return pipfile_req

def val_with_pos(kind, text, value, pos):
    return (value, pos)

def parse(file_contents):
    data = pytoml.loads(file_contents, translate=val_with_pos)

    sections = ['packages', 'dev-packages']
    res = dict.fromkeys(sections)
    for section in sections:
        if section not in data:
            continue

        section_data = data[section]

        res[section] = [
            PipfileRequirement.from_dict(
                name,
                value if not utils.is_string(value) else {'version': value},
                pos,
            )
            for name, (value, pos) in sorted(section_data.items())
        ]

    return res
